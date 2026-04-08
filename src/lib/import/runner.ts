import type { Payload } from 'payload'
import { type CategorySlug } from '@/types/strings'
import { Locales } from '@/types/enums/locale'
import {
  computeRetailPrice,
  type FxRates,
  type PricingPolicy,
} from '@/lib/import/pricing'
import {
  type ManifestProduct,
  type SupplierManifest,
} from '@/lib/import/manifest'
import { type FileSource } from '@/lib/import/sources'
import { type FxRateProvider } from '@/lib/import/fxRates'
import {
  buildProductData,
  type Logger,
  type MediaUploadStats,
  NOOP_LOGGER,
  uploadProductImages,
} from '@/lib/import/productBuilder'

export type { Logger } from '@/lib/import/productBuilder'

export interface RunImportOptions {
  readonly manifest: SupplierManifest
  readonly fileSource: FileSource
  readonly fxProvider: FxRateProvider
  readonly pricingPolicy: PricingPolicy
  readonly dryRun: boolean
  readonly allowCreateCategories: boolean
  readonly logger?: Logger
}

export interface ImportEntryError {
  readonly sku: string
  readonly message: string
}

export interface ImportResult {
  readonly created: number
  readonly updated: number
  readonly skippedLocked: number
  readonly mediaUploaded: number
  readonly mediaReused: number
  readonly errors: readonly ImportEntryError[]
  readonly fxRates: FxRates
  readonly fxProviderName: string
}

interface ResolvedCategoryMap {
  readonly bySlug: ReadonlyMap<CategorySlug, number>
}

async function buildCategoryMap(
  payload: Payload,
  manifest: SupplierManifest,
  allowCreate: boolean,
  logger: Logger,
): Promise<ResolvedCategoryMap> {
  const neededSlugs = new Set<CategorySlug>()
  for (const p of manifest.products) neededSlugs.add(p.category)

  const map = new Map<CategorySlug, number>()
  for (const slug of neededSlugs) {
    const result = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    if (result.docs.length > 0) {
      map.set(slug, result.docs[0].id)
      continue
    }
    if (!allowCreate) {
      throw new Error(
        `Category "${slug}" not found in DB. Pass --allow-create-categories to auto-create it.`,
      )
    }
    logger.info(`[category] auto-creating "${slug}"`)
    const created = await payload.create({
      collection: 'categories',
      data: { name: slug, slug, sortOrder: 99 },
      locale: Locales.Fr,
    })
    map.set(slug, created.id)
  }
  return { bySlug: map }
}

export async function runImport(
  payload: Payload,
  opts: RunImportOptions,
): Promise<ImportResult> {
  const logger = opts.logger ?? NOOP_LOGGER
  const { manifest, fileSource, fxProvider, pricingPolicy, dryRun, allowCreateCategories } = opts

  const fxRates = await fxProvider.getRates()
  const fxProviderName = fxProvider.describe()
  const sourceLabel = `${manifest.supplier.reference} (${fileSource.describe()})`

  const categoryMap = await buildCategoryMap(payload, manifest, allowCreateCategories, logger)

  const errors: ImportEntryError[] = []
  const mediaStats: MediaUploadStats = { uploaded: 0, reused: 0 }
  let created = 0
  let updated = 0
  let skippedLocked = 0

  for (const product of manifest.products) {
    try {
      const result = await importOneProduct(payload, {
        product,
        manifest,
        fxRates,
        fxProviderName,
        pricingPolicy,
        fileSource,
        sourceLabel,
        categoryMap,
        dryRun,
        mediaStats,
        logger,
      })
      if (result === 'created') created++
      else if (result === 'updated') updated++
      else if (result === 'skippedLocked') skippedLocked++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ sku: product.sku, message })
      logger.error(`[error] ${product.sku}: ${message}`)
    }
  }

  return {
    created,
    updated,
    skippedLocked,
    mediaUploaded: mediaStats.uploaded,
    mediaReused: mediaStats.reused,
    errors,
    fxRates,
    fxProviderName,
  }
}

interface ImportOneProductInput {
  readonly product: ManifestProduct
  readonly manifest: SupplierManifest
  readonly fxRates: FxRates
  readonly fxProviderName: string
  readonly pricingPolicy: PricingPolicy
  readonly fileSource: FileSource
  readonly sourceLabel: string
  readonly categoryMap: ResolvedCategoryMap
  readonly dryRun: boolean
  readonly mediaStats: MediaUploadStats
  readonly logger: Logger
}

async function importOneProduct(
  payload: Payload,
  input: ImportOneProductInput,
): Promise<'created' | 'updated' | 'skippedLocked'> {
  const { product, manifest, fxRates, fxProviderName, pricingPolicy } = input

  const existingResult = await payload.find({
    collection: 'products',
    where: { sku: { equals: product.sku } },
    limit: 1,
  })
  const existing = existingResult.docs[0]

  if (existing && existing.importMeta?.locked === true) {
    input.logger.info(`[skip] ${product.sku}: locked against import`)
    return 'skippedLocked'
  }

  const priceHT = computeRetailPrice(
    product.source.amount,
    product.source.currency,
    fxRates,
    pricingPolicy,
  )

  const categoryId = input.categoryMap.bySlug.get(product.category)
  if (categoryId === undefined) {
    throw new Error(`category "${product.category}" not resolved`)
  }

  const imageRefs = await uploadProductImages(
    payload,
    {
      sku: product.sku,
      images: product.images,
      fileSource: input.fileSource,
      dryRun: input.dryRun,
    },
    input.mediaStats,
    input.logger,
  )

  const built = buildProductData({
    sku: product.sku,
    name: product.name,
    shortDescription: product.shortDescription,
    priceHT,
    tvaRate: manifest.defaults.tvaRate,
    status: manifest.defaults.status,
    initialStock: manifest.defaults.initialStock,
    lowStockThreshold: manifest.defaults.lowStockThreshold,
    trackStock: manifest.defaults.trackStock,
    categoryId,
    imageRefs,
    specs: product.specs,
    physical: product.physical,
    importLocked: product.importLocked,
    fxRates,
    fxProviderName,
    sourceCurrency: product.source.currency,
    sourceAmount: product.source.amount,
    sourceLabel: input.sourceLabel,
  })

  if (input.dryRun) {
    const action = existing ? 'update' : 'create'
    input.logger.info(
      `[dry-run] ${action} ${product.sku}: priceHT=${priceHT} cents, name="${product.name.fr}"`,
    )
    return existing ? 'updated' : 'created'
  }

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
    input.logger.info(`[update] ${product.sku} (id=${existing.id})`)
    return 'updated'
  } else {
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
    input.logger.info(`[create] ${product.sku} (id=${createdDoc.id})`)
    return 'created'
  }
}
