import type { Payload } from 'payload'
import { categorySlug, type CategorySlug } from '@/types/strings'
import { Locales } from '@/types/enums/locale'
import { TVARates, type TVARate } from '@/types/enums/tva-rate'
import { ProductStatuses, type ProductStatus } from '@/types/enums/product-status'
import {
  computeRetailPrice,
  type FxRates,
  type PricingPolicy,
  DEFAULT_PRICING_POLICY,
  type SourceCurrency,
} from '@/lib/import/pricing'
import { type FxRateProvider } from '@/lib/import/fxRates'
import { SeafileFileSource } from '@/lib/import/sources'
import {
  buildProductData,
  type Logger,
  type MediaUploadStats,
  NOOP_LOGGER,
  uploadProductImages,
} from '@/lib/import/productBuilder'
import { type LocalizedString, type ManifestSpec } from '@/lib/import/manifest'

/**
 * Apply a single LLM-extracted candidate to the products collection. Wraps
 * the per-product logic of {@link runImport} for the interactive
 * scan-supplier wizard, where the admin reviews + confirms one candidate at
 * a time. Reuses {@link buildProductData} and {@link uploadProductImages}.
 */

export interface CandidateInput {
  readonly sku: string
  readonly name: LocalizedString
  readonly shortDescription: LocalizedString
  readonly categorySlug: string
  readonly brand?: string
  readonly sourceCurrency: SourceCurrency
  readonly sourceAmount: number
  readonly specs: readonly ManifestSpec[]
  readonly imagePaths: readonly { path: string; alt?: LocalizedString }[]
}

export interface ApplyCandidateOptions {
  readonly libraryId: string
  readonly libraryName: string
  readonly fxProvider: FxRateProvider
  readonly pricingPolicy?: PricingPolicy
  readonly allowCreateCategories?: boolean
  readonly defaults?: Partial<ApplyCandidateDefaults>
  readonly logger?: Logger
}

export interface ApplyCandidateDefaults {
  readonly tvaRate: TVARate
  readonly status: ProductStatus
  readonly initialStock: number
  readonly lowStockThreshold: number
  readonly trackStock: boolean
  readonly importLocked: boolean
}

export const APPLY_CANDIDATE_DEFAULTS: ApplyCandidateDefaults = {
  tvaRate: TVARates.Standard,
  status: ProductStatuses.Draft,
  initialStock: 10,
  lowStockThreshold: 5,
  trackStock: true,
  importLocked: false,
}

export type ApplyCandidateOutcome =
  | {
      readonly status: 'created' | 'updated'
      readonly productId: number
      readonly mediaUploaded: number
      readonly mediaReused: number
    }
  | { readonly status: 'skippedLocked'; readonly productId: number }

/**
 * Look up a category by slug, optionally creating it if missing. Mirrors the
 * behaviour of `buildCategoryMap` in `runner.ts` but for one slug at a time.
 */
async function resolveCategoryId(
  payload: Payload,
  slug: CategorySlug,
  allowCreate: boolean,
  logger: Logger,
): Promise<number> {
  const result = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  if (result.docs.length > 0) return result.docs[0].id
  if (!allowCreate) {
    throw new Error(
      `Category "${slug}" not found. Enable "create missing categories" to auto-create it.`,
    )
  }
  logger.info(`[category] auto-creating "${slug}"`)
  const created = await payload.create({
    collection: 'categories',
    data: { name: slug, slug, sortOrder: 99 },
    locale: Locales.Fr,
  })
  return created.id
}

export async function applyCandidate(
  payload: Payload,
  candidate: CandidateInput,
  opts: ApplyCandidateOptions,
): Promise<ApplyCandidateOutcome> {
  const logger = opts.logger ?? NOOP_LOGGER
  const defaults: ApplyCandidateDefaults = {
    ...APPLY_CANDIDATE_DEFAULTS,
    ...opts.defaults,
  }
  const policy = opts.pricingPolicy ?? DEFAULT_PRICING_POLICY

  // Look up existing product by SKU; honour the importMeta.locked flag.
  const existingResult = await payload.find({
    collection: 'products',
    where: { sku: { equals: candidate.sku } },
    limit: 1,
  })
  const existing = existingResult.docs[0]
  if (existing && existing.importMeta?.locked === true) {
    logger.info(`[skip] ${candidate.sku}: locked against import`)
    return { status: 'skippedLocked', productId: existing.id }
  }

  // Resolve target category by slug.
  const slug = categorySlug(candidate.categorySlug)
  const categoryId = await resolveCategoryId(
    payload,
    slug,
    opts.allowCreateCategories ?? true,
    logger,
  )

  // FX rates + price.
  const fxRates: FxRates = await opts.fxProvider.getRates()
  const fxProviderName = opts.fxProvider.describe()
  const priceHT = computeRetailPrice(
    candidate.sourceAmount,
    candidate.sourceCurrency,
    fxRates,
    policy,
  )

  // Upload images. We always live-fetch from Seafile because the wizard's
  // UX requires the user to see them before confirming, so they're already
  // cached server-side. dryRun is false here — confirm = persist.
  const fileSource = new SeafileFileSource(opts.libraryId)
  const mediaStats: MediaUploadStats = { uploaded: 0, reused: 0 }
  const imageRefs = await uploadProductImages(
    payload,
    {
      sku: candidate.sku,
      images: candidate.imagePaths.map((i) => ({ path: i.path, alt: i.alt })),
      fileSource,
      dryRun: false,
    },
    mediaStats,
    logger,
  )

  // Build the FR + EN payloads using the shared helper.
  const built = buildProductData({
    sku: candidate.sku,
    name: candidate.name,
    shortDescription: candidate.shortDescription,
    priceHT,
    tvaRate: defaults.tvaRate,
    status: defaults.status,
    initialStock: defaults.initialStock,
    lowStockThreshold: defaults.lowStockThreshold,
    trackStock: defaults.trackStock,
    categoryId,
    imageRefs,
    specs: candidate.specs,
    importLocked: defaults.importLocked,
    fxRates,
    fxProviderName,
    sourceCurrency: candidate.sourceCurrency,
    sourceAmount: candidate.sourceAmount,
    sourceLabel: `scan:${opts.libraryName}`,
  })

  if (existing) {
    await payload.update({
      collection: 'products',
      id: existing.id,
      draft: true,
      locale: Locales.Fr,
      data: built.frPayload,
    })
    await payload.update({
      collection: 'products',
      id: existing.id,
      draft: true,
      locale: Locales.En,
      data: built.enLocalizedDelta,
    })
    logger.info(`[update] ${candidate.sku} (id=${existing.id})`)
    return {
      status: 'updated',
      productId: existing.id,
      mediaUploaded: mediaStats.uploaded,
      mediaReused: mediaStats.reused,
    }
  }

  const createdDoc = await payload.create({
    collection: 'products',
    draft: true,
    locale: Locales.Fr,
    data: built.frPayload,
  })
  await payload.update({
    collection: 'products',
    id: createdDoc.id,
    draft: true,
    locale: Locales.En,
    data: built.enLocalizedDelta,
  })
  logger.info(`[create] ${candidate.sku} (id=${createdDoc.id})`)
  return {
    status: 'created',
    productId: createdDoc.id,
    mediaUploaded: mediaStats.uploaded,
    mediaReused: mediaStats.reused,
  }
}
