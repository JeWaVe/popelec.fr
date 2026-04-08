import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { UserRoles } from '@/types/enums/user-role'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { ProductCandidateStatuses } from '@/collections/ProductCandidates'
import { ImportSessionStatuses } from '@/collections/ImportSessions'
import { applyCandidate, type CandidateInput } from '@/lib/import/candidates'
import { ExchangeRateHostProvider, StaticFxRateProvider } from '@/lib/import/fxRates'
import { isSourceCurrency, type SourceCurrency } from '@/lib/import/pricing'
import { type LocalizedString, type ManifestSpec } from '@/lib/import/manifest'

interface EditedFields {
  proposedSku?: unknown
  proposedName?: unknown
  proposedNameEn?: unknown
  proposedShortDescription?: unknown
  proposedShortDescriptionEn?: unknown
  proposedCategorySlug?: unknown
  proposedBrand?: unknown
  proposedSourceCurrency?: unknown
  proposedSourceAmount?: unknown
  proposedSpecsJson?: unknown
  offline?: unknown
  allowCreateCategories?: unknown
  importLocked?: unknown
}

interface NormalizedCandidateFields {
  sku: string
  nameFr: string
  nameEn: string
  shortFr: string
  shortEn: string
  categorySlug: string
  brand: string | null
  currency: SourceCurrency
  amount: number
  specs: ManifestSpec[]
  offline: boolean
  allowCreateCategories: boolean
  importLocked: boolean
}

function asString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim() !== '') return value
  return fallback
}

function asOptionalString(value: unknown, fallback: string | null): string | null {
  if (value === null) return null
  if (typeof value === 'string') return value === '' ? null : value
  return fallback
}

function parseSpecsJson(raw: unknown, fallback: string | null): ManifestSpec[] {
  const text = typeof raw === 'string' ? raw : fallback
  if (!text || text.trim() === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('proposedSpecsJson is not valid JSON')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('proposedSpecsJson must be a JSON array')
  }
  const out: ManifestSpec[] = []
  for (let i = 0; i < parsed.length; i++) {
    const s = parsed[i] as Record<string, unknown> | null
    if (!s || typeof s !== 'object') {
      throw new Error(`proposedSpecs[${i}]: must be an object`)
    }
    const label = s.label as Record<string, unknown> | undefined
    const value = s.value as Record<string, unknown> | undefined
    if (
      !label ||
      typeof label.fr !== 'string' ||
      typeof label.en !== 'string' ||
      !value ||
      typeof value.fr !== 'string' ||
      typeof value.en !== 'string'
    ) {
      throw new Error(`proposedSpecs[${i}]: requires {label:{fr,en}, value:{fr,en}}`)
    }
    out.push({
      label: { fr: label.fr, en: label.en } satisfies LocalizedString,
      value: { fr: value.fr, en: value.en } satisfies LocalizedString,
      unit: typeof s.unit === 'string' ? s.unit : undefined,
      group: typeof s.group === 'string' ? s.group : undefined,
    })
  }
  return out
}

interface CandidateRecord {
  id: number
  proposedSku: string
  proposedName: string
  proposedNameEn?: string | null
  proposedShortDescription?: string | null
  proposedShortDescriptionEn?: string | null
  proposedCategorySlug?: string | null
  proposedBrand?: string | null
  proposedSourceCurrency?: string | null
  proposedSourceAmount?: number | null
  proposedSpecsJson?: string | null
  proposedImagePaths?: Array<{
    path: string
    altFr?: string | null
    altEn?: string | null
  }> | null
  session: number | { id: number }
}

function normalize(
  candidate: CandidateRecord,
  edits: EditedFields,
): NormalizedCandidateFields {
  const sku = asString(edits.proposedSku, candidate.proposedSku)
  const nameFr = asString(edits.proposedName, candidate.proposedName)
  const nameEn = asString(
    edits.proposedNameEn,
    candidate.proposedNameEn ?? candidate.proposedName,
  )
  const shortFr = asString(
    edits.proposedShortDescription,
    candidate.proposedShortDescription ?? '',
  )
  const shortEn = asString(
    edits.proposedShortDescriptionEn,
    candidate.proposedShortDescriptionEn ?? shortFr,
  )
  const categorySlug = asString(
    edits.proposedCategorySlug,
    candidate.proposedCategorySlug ?? '',
  )
  if (categorySlug === '') {
    throw new Error('proposedCategorySlug is required')
  }
  const brand = asOptionalString(edits.proposedBrand, candidate.proposedBrand ?? null)

  const currencyRaw =
    typeof edits.proposedSourceCurrency === 'string'
      ? edits.proposedSourceCurrency.toUpperCase()
      : candidate.proposedSourceCurrency ?? 'USD'
  if (!isSourceCurrency(currencyRaw)) {
    throw new Error('proposedSourceCurrency must be USD, CNY, or EUR')
  }
  const currency: SourceCurrency = currencyRaw

  const amountRaw =
    typeof edits.proposedSourceAmount === 'number'
      ? edits.proposedSourceAmount
      : candidate.proposedSourceAmount ?? 0
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    throw new Error('proposedSourceAmount must be a positive finite number')
  }

  const specs = parseSpecsJson(edits.proposedSpecsJson, candidate.proposedSpecsJson ?? null)

  return {
    sku,
    nameFr,
    nameEn,
    shortFr,
    shortEn,
    categorySlug,
    brand,
    currency,
    amount: amountRaw,
    specs,
    offline: edits.offline === true,
    allowCreateCategories: edits.allowCreateCategories === true,
    importLocked: edits.importLocked === true,
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = rateLimit(getClientIp(req), 'scan-supplier-confirm', {
      limit: 30,
      windowSec: 60,
    })
    if (blocked) return blocked

    const payload = await getPayload()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== UserRoles.Admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const candidateId = Number.parseInt(id, 10)
    if (!Number.isFinite(candidateId) || candidateId <= 0) {
      return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
    }

    let edits: EditedFields = {}
    try {
      edits = (await req.json()) as EditedFields
    } catch {
      // Empty body is allowed — confirm with no edits
    }

    let candidateDoc
    try {
      candidateDoc = (await payload.findByID({
        collection: 'product-candidates',
        id: candidateId,
        depth: 0,
      })) as unknown as CandidateRecord
    } catch {
      return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 })
    }

    const sessionId =
      typeof candidateDoc.session === 'number'
        ? candidateDoc.session
        : candidateDoc.session.id
    const sessionDoc = await payload.findByID({
      collection: 'import-sessions',
      id: sessionId,
    })

    let normalized: NormalizedCandidateFields
    try {
      normalized = normalize(candidateDoc, edits)
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Validation failed' },
        { status: 400 },
      )
    }

    const imagePaths = (candidateDoc.proposedImagePaths ?? []).map((img) => ({
      path: img.path,
      alt:
        img.altFr || img.altEn
          ? ({
              fr: img.altFr ?? '',
              en: img.altEn ?? img.altFr ?? '',
            } satisfies LocalizedString)
          : undefined,
    }))

    if (imagePaths.length === 0) {
      return NextResponse.json(
        { error: 'Le candidat doit avoir au moins une image' },
        { status: 400 },
      )
    }

    const candidateInput: CandidateInput = {
      sku: normalized.sku,
      name: { fr: normalized.nameFr, en: normalized.nameEn },
      shortDescription: { fr: normalized.shortFr, en: normalized.shortEn },
      categorySlug: normalized.categorySlug,
      brand: normalized.brand ?? undefined,
      sourceCurrency: normalized.currency,
      sourceAmount: normalized.amount,
      specs: normalized.specs,
      imagePaths,
    }

    const fxProvider = normalized.offline
      ? new StaticFxRateProvider()
      : new ExchangeRateHostProvider()

    try {
      const outcome = await applyCandidate(payload, candidateInput, {
        libraryId: sessionDoc.libraryId,
        libraryName: sessionDoc.libraryName,
        fxProvider,
        allowCreateCategories: normalized.allowCreateCategories,
        defaults: { importLocked: normalized.importLocked },
      })

      const productId =
        outcome.status === 'skippedLocked' ? outcome.productId : outcome.productId

      await payload.update({
        collection: 'product-candidates',
        id: candidateId,
        data: {
          status: ProductCandidateStatuses.Confirmed,
          confirmedProduct: productId,
          reviewedAt: new Date().toISOString(),
          reviewedBy: user.id,
          errorMessage: null,
        },
      })

      // Move session to in_review on first confirm
      if (sessionDoc.status === ImportSessionStatuses.Ready) {
        await payload.update({
          collection: 'import-sessions',
          id: sessionId,
          data: { status: ImportSessionStatuses.InReview },
        })
      }

      return NextResponse.json({ ok: true, outcome })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await payload.update({
        collection: 'product-candidates',
        id: candidateId,
        data: {
          status: ProductCandidateStatuses.Error,
          errorMessage: message,
        },
      })
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (err) {
    console.error('[scan-supplier/confirm] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
