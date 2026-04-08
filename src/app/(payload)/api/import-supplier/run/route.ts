import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { UserRoles } from '@/types/enums/user-role'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { downloadSeafileFile } from '@/lib/seafile'
import { loadManifest, ManifestValidationError } from '@/lib/import/manifest'
import { SeafileFileSource } from '@/lib/import/sources'
import {
  ExchangeRateHostProvider,
  StaticFxRateProvider,
  type FxRateProvider,
} from '@/lib/import/fxRates'
import { DEFAULT_PRICING_POLICY, type PricingPolicy } from '@/lib/import/pricing'
import { runImport, type Logger } from '@/lib/import/runner'

interface RunBody {
  manifestName?: unknown
  dryRun?: unknown
  offline?: unknown
  allowCreateCategories?: unknown
  margin?: unknown
  landed?: unknown
}

interface ParsedBody {
  manifestName: string
  dryRun: boolean
  offline: boolean
  allowCreateCategories: boolean
  margin: number | undefined
  landed: number | undefined
}

function parseBody(raw: RunBody): ParsedBody | { error: string } {
  if (typeof raw.manifestName !== 'string' || raw.manifestName.length === 0) {
    return { error: 'manifestName is required' }
  }
  // Reject path traversal — must be a simple basename ending in .yaml/.yml
  const name = raw.manifestName
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return { error: 'manifestName must be a basename (no path separators)' }
  }
  if (!/\.(yaml|yml)$/i.test(name)) {
    return { error: 'manifestName must end in .yaml or .yml' }
  }
  if (name.length > 200) {
    return { error: 'manifestName too long' }
  }

  const margin = raw.margin === undefined || raw.margin === null ? undefined : Number(raw.margin)
  if (margin !== undefined && (!Number.isFinite(margin) || margin <= 0)) {
    return { error: 'margin must be a positive number' }
  }
  const landed = raw.landed === undefined || raw.landed === null ? undefined : Number(raw.landed)
  if (landed !== undefined && (!Number.isFinite(landed) || landed < 0)) {
    return { error: 'landed must be a non-negative number' }
  }

  return {
    manifestName: name,
    dryRun: raw.dryRun === true,
    offline: raw.offline === true,
    allowCreateCategories: raw.allowCreateCategories === true,
    margin,
    landed,
  }
}

interface CapturedLog {
  level: 'info' | 'warn' | 'error'
  message: string
}

function makeCapturingLogger(): { logger: Logger; logs: CapturedLog[] } {
  const logs: CapturedLog[] = []
  const logger: Logger = {
    info: (m) => logs.push({ level: 'info', message: m }),
    warn: (m) => logs.push({ level: 'warn', message: m }),
    error: (m) => logs.push({ level: 'error', message: m }),
  }
  return { logger, logs }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit before auth so we don't reveal admin paths
    const blocked = rateLimit(getClientIp(req), 'import-supplier-run', {
      limit: 5,
      windowSec: 60,
    })
    if (blocked) return blocked

    const payload = await getPayload()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== UserRoles.Admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    let raw: RunBody
    try {
      raw = (await req.json()) as RunBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = parseBody(raw)
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const libraryId = process.env.SEAFILE_IMPORT_LIBRARY_ID
    if (!libraryId) {
      return NextResponse.json(
        { error: 'SEAFILE_IMPORT_LIBRARY_ID env var is not set' },
        { status: 500 },
      )
    }
    const manifestDir = process.env.SEAFILE_IMPORT_MANIFEST_DIR || '/manifests'
    const manifestPath = `${manifestDir.replace(/\/$/, '')}/${parsed.manifestName}`

    // Download + parse manifest
    let manifestText: string
    try {
      const buf = await downloadSeafileFile(libraryId, manifestPath)
      manifestText = buf.toString('utf8')
    } catch (err) {
      return NextResponse.json(
        { error: `Could not download manifest: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      )
    }

    let manifest
    try {
      manifest = loadManifest(manifestText)
    } catch (err) {
      if (err instanceof ManifestValidationError) {
        return NextResponse.json(
          { error: 'Manifest validation failed', issues: err.issues },
          { status: 400 },
        )
      }
      throw err
    }

    const fileSource = new SeafileFileSource(libraryId)
    const fxProvider: FxRateProvider = parsed.offline
      ? new StaticFxRateProvider()
      : new ExchangeRateHostProvider()

    const policy: PricingPolicy = {
      landedCostFraction: parsed.landed ?? DEFAULT_PRICING_POLICY.landedCostFraction,
      margin: parsed.margin ?? DEFAULT_PRICING_POLICY.margin,
    }

    const { logger, logs } = makeCapturingLogger()

    const result = await runImport(payload, {
      manifest,
      fileSource,
      fxProvider,
      pricingPolicy: policy,
      dryRun: parsed.dryRun,
      allowCreateCategories: parsed.allowCreateCategories,
      logger,
    })

    return NextResponse.json({
      ok: result.errors.length === 0,
      manifestPath,
      productCount: manifest.products.length,
      result: {
        created: result.created,
        updated: result.updated,
        skippedLocked: result.skippedLocked,
        mediaUploaded: result.mediaUploaded,
        mediaReused: result.mediaReused,
        errors: result.errors,
        fxRates: result.fxRates,
        fxProviderName: result.fxProviderName,
      },
      logs,
    })
  } catch (err) {
    console.error('[import-supplier/run] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
