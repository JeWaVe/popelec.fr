import type { Payload } from 'payload'
import { extname } from 'node:path'
import { type PriceCents } from '@/types/money'
import { ProductStatuses, type ProductStatus } from '@/types/enums/product-status'
import { TVARates, type TVARate } from '@/types/enums/tva-rate'
import { Locales } from '@/types/enums/locale'
import { slugify } from '@/lib/slug'
import { type FxRates } from '@/lib/import/pricing'
import { type FileSource, pathBasename } from '@/lib/import/sources'
import {
  type LocalizedString,
  type ManifestImage,
  type ManifestPhysical,
  type ManifestSpec,
} from '@/lib/import/manifest'

/**
 * Per-product helpers used by both the YAML manifest runner and the
 * interactive scan-supplier wizard. Pure of any orchestration: callers
 * decide upsert/lock semantics.
 */

export interface MediaUploadStats {
  uploaded: number
  reused: number
}

export interface Logger {
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
}

export const NOOP_LOGGER: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
}

export function mimeForExt(ext: string): string {
  return MIME_BY_EXT[ext.toLowerCase()] ?? 'application/octet-stream'
}

export function normalizedMediaFilename(
  sku: string,
  originalPath: string,
  index: number,
): string {
  const ext = extname(pathBasename(originalPath)) || '.bin'
  const safeSku = slugify(sku)
  return `${safeSku}-${index + 1}${ext.toLowerCase()}`
}

export async function findExistingMediaIdByFilename(
  payload: Payload,
  filename: string,
): Promise<number | null> {
  const result = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
  })
  return result.docs.length > 0 ? result.docs[0].id : null
}

export interface UploadProductImagesInput {
  readonly sku: string
  readonly images: readonly ManifestImage[]
  readonly fileSource: FileSource
  readonly dryRun: boolean
}

export async function uploadProductImages(
  payload: Payload,
  input: UploadProductImagesInput,
  stats: MediaUploadStats,
  logger: Logger = NOOP_LOGGER,
): Promise<readonly { image: number; alt?: string }[]> {
  const out: { image: number; alt?: string }[] = []
  for (let i = 0; i < input.images.length; i++) {
    const img = input.images[i]
    const filename = normalizedMediaFilename(input.sku, img.path, i)

    const existing = await findExistingMediaIdByFilename(payload, filename)
    if (existing !== null) {
      stats.reused++
      out.push({ image: existing, alt: img.alt?.fr })
      continue
    }

    if (input.dryRun) {
      logger.info(`[dry-run] would upload media ${filename} for ${input.sku}`)
      stats.uploaded++
      // Sentinel id of -1 in dry-run; not persisted.
      out.push({ image: -1, alt: img.alt?.fr })
      continue
    }

    const data = await input.fileSource.read(img.path)
    const mimetype = mimeForExt(extname(filename))
    const created = await payload.create({
      collection: 'media',
      file: {
        data,
        mimetype,
        name: filename,
        size: data.byteLength,
      },
      data: {
        alt: img.alt?.fr ?? '',
      },
    })

    if (img.alt?.en) {
      await payload.update({
        collection: 'media',
        id: created.id,
        locale: Locales.En,
        data: { alt: img.alt.en },
      })
    }

    stats.uploaded++
    out.push({ image: created.id, alt: img.alt?.fr })
    logger.info(`[media] uploaded ${filename} (id=${created.id})`)
  }
  return out
}

export interface BuildProductDataInput {
  readonly sku: string
  readonly name: LocalizedString
  readonly shortDescription: LocalizedString
  readonly priceHT: PriceCents
  readonly tvaRate: TVARate
  readonly status: ProductStatus
  readonly initialStock: number
  readonly lowStockThreshold: number
  readonly trackStock: boolean
  readonly categoryId: number
  readonly imageRefs: readonly { image: number; alt?: string }[]
  readonly specs: readonly ManifestSpec[]
  readonly physical?: ManifestPhysical
  readonly importLocked: boolean
  readonly fxRates: FxRates
  readonly fxProviderName: string
  readonly sourceCurrency: string
  readonly sourceAmount: number
  readonly sourceLabel: string
}

export interface BuiltProductData {
  readonly frPayload: Record<string, unknown>
  readonly enLocalizedDelta: Record<string, unknown>
}

export function buildProductData(input: BuildProductDataInput): BuiltProductData {
  const frSpecs: Array<{
    label: string
    value: string
    unit?: string
    group?: string
  }> = input.specs.map((s) => ({
    label: s.label.fr,
    value: s.value.fr,
    unit: s.unit,
    group: s.group,
  }))

  const enSpecs: Array<{ label: string; value: string }> = input.specs.map((s) => ({
    label: s.label.en,
    value: s.value.en,
  }))

  const frImages = input.imageRefs.map((r) => ({ image: r.image, alt: r.alt ?? '' }))

  const slug = slugify(input.sku)

  const fxSnapshotJson = JSON.stringify({
    rates: input.fxRates,
    provider: input.fxProviderName,
    capturedAt: new Date().toISOString(),
    sourceCurrency: input.sourceCurrency,
    sourceAmount: input.sourceAmount,
  })

  const frPayload: Record<string, unknown> = {
    name: input.name.fr,
    slug,
    sku: input.sku,
    status: input.status,
    shortDescription: input.shortDescription.fr,
    pricing: {
      priceHT: input.priceHT,
      tvaRate: input.tvaRate,
    },
    stock: {
      quantity: input.initialStock,
      lowStockThreshold: input.lowStockThreshold,
      trackStock: input.trackStock,
    },
    categories: [input.categoryId],
    images: frImages,
    specs: frSpecs,
    physical: input.physical
      ? {
          weight: input.physical.weight,
          length: input.physical.length,
          width: input.physical.width,
          height: input.physical.height,
        }
      : undefined,
    importMeta: {
      locked: input.importLocked,
      lastImportedAt: new Date().toISOString(),
      source: input.sourceLabel,
      fxSnapshot: fxSnapshotJson,
    },
  }

  const enLocalizedDelta: Record<string, unknown> = {
    name: input.name.en,
    shortDescription: input.shortDescription.en,
    specs: enSpecs,
  }

  return { frPayload, enLocalizedDelta }
}

/** Default tvaRate / status used when callers don't specify them. */
export const PRODUCT_BUILDER_DEFAULTS = {
  tvaRate: TVARates.Standard as TVARate,
  status: ProductStatuses.Draft as ProductStatus,
  initialStock: 10,
  lowStockThreshold: 5,
  trackStock: true,
} as const
