import { readFile } from 'node:fs/promises'
import { parse as parseYaml } from 'yaml'
import { type CategorySlug, categorySlug, type SKU, sku as toSku } from '@/types/strings'
import { ProductStatuses, type ProductStatus } from '@/types/enums/product-status'
import { TVARates, type TVARate } from '@/types/enums/tva-rate'
import {
  isSourceCurrency,
  type SourceCurrency,
  SOURCE_CURRENCY_VALUES,
} from '@/lib/import/pricing'

// --- Domain types ----------------------------------------------------------

export interface LocalizedString {
  readonly fr: string
  readonly en: string
}

export interface ManifestSpec {
  readonly label: LocalizedString
  readonly value: LocalizedString
  readonly unit?: string
  readonly group?: string
}

export interface ManifestImage {
  readonly path: string
  readonly alt?: LocalizedString
}

export interface ManifestDatasheet {
  readonly path: string
  readonly title: LocalizedString
}

export interface ManifestSourcePrice {
  readonly currency: SourceCurrency
  readonly amount: number
  readonly originSku?: string
}

export interface ManifestPhysical {
  readonly weight?: number
  readonly length?: number
  readonly width?: number
  readonly height?: number
}

export interface ManifestProduct {
  readonly sku: SKU
  readonly category: CategorySlug
  readonly brand?: string
  readonly name: LocalizedString
  readonly shortDescription: LocalizedString
  readonly source: ManifestSourcePrice
  readonly specs: readonly ManifestSpec[]
  readonly physical?: ManifestPhysical
  readonly images: readonly ManifestImage[]
  readonly datasheets: readonly ManifestDatasheet[]
  readonly importLocked: boolean
}

export interface ManifestDefaults {
  readonly tvaRate: TVARate
  readonly trackStock: boolean
  readonly lowStockThreshold: number
  readonly initialStock: number
  readonly status: ProductStatus
}

export interface SupplierMeta {
  readonly name: string
  readonly reference: string
}

export interface SupplierManifest {
  readonly version: 1
  readonly supplier: SupplierMeta
  readonly defaults: ManifestDefaults
  readonly products: readonly ManifestProduct[]
}

// --- Validation ------------------------------------------------------------

export class ManifestValidationError extends Error {
  readonly issues: readonly string[]
  constructor(issues: readonly string[]) {
    super(`Manifest validation failed:\n  - ${issues.join('\n  - ')}`)
    this.name = 'ManifestValidationError'
    this.issues = issues
  }
}

const SKU_RE = /^[A-Za-z0-9._-]{3,64}$/
const REFERENCE_RE = /^[a-z0-9-]{3,64}$/
const CATEGORY_RE = /^[a-z0-9-]{2,64}$/

const DEFAULT_DEFAULTS: ManifestDefaults = {
  tvaRate: TVARates.Standard,
  trackStock: true,
  lowStockThreshold: 5,
  initialStock: 10,
  status: ProductStatuses.Draft,
}

interface ValidationContext {
  readonly issues: string[]
  readonly path: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(ctx: ValidationContext, value: unknown, field: string): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    ctx.issues.push(`${ctx.path}.${field}: required non-empty string`)
    return null
  }
  return value
}

function requireLocalizedString(
  ctx: ValidationContext,
  value: unknown,
  field: string,
): LocalizedString | null {
  if (!isPlainObject(value)) {
    ctx.issues.push(`${ctx.path}.${field}: required object with { fr, en }`)
    return null
  }
  const fr = value.fr
  const en = value.en
  if (typeof fr !== 'string' || fr.trim() === '') {
    ctx.issues.push(`${ctx.path}.${field}.fr: required non-empty string`)
    return null
  }
  if (typeof en !== 'string' || en.trim() === '') {
    ctx.issues.push(`${ctx.path}.${field}.en: required non-empty string`)
    return null
  }
  return { fr, en }
}

function optionalLocalizedString(
  ctx: ValidationContext,
  value: unknown,
  field: string,
): LocalizedString | undefined {
  if (value == null) return undefined
  const result = requireLocalizedString(ctx, value, field)
  return result ?? undefined
}

function optionalNumber(
  ctx: ValidationContext,
  value: unknown,
  field: string,
): number | undefined {
  if (value == null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    ctx.issues.push(`${ctx.path}.${field}: must be a finite number`)
    return undefined
  }
  return value
}

function optionalString(
  ctx: ValidationContext,
  value: unknown,
  field: string,
): string | undefined {
  if (value == null) return undefined
  if (typeof value !== 'string') {
    ctx.issues.push(`${ctx.path}.${field}: must be a string`)
    return undefined
  }
  return value
}

function validateSpec(ctx: ValidationContext, raw: unknown, index: number): ManifestSpec | null {
  const childCtx: ValidationContext = { issues: ctx.issues, path: `${ctx.path}.specs[${index}]` }
  if (!isPlainObject(raw)) {
    childCtx.issues.push(`${childCtx.path}: must be an object`)
    return null
  }
  const label = requireLocalizedString(childCtx, raw.label, 'label')
  const value = requireLocalizedString(childCtx, raw.value, 'value')
  const unit = optionalString(childCtx, raw.unit, 'unit')
  const group = optionalString(childCtx, raw.group, 'group')
  if (!label || !value) return null
  return { label, value, unit, group }
}

function validateImage(ctx: ValidationContext, raw: unknown, index: number): ManifestImage | null {
  const childCtx: ValidationContext = { issues: ctx.issues, path: `${ctx.path}.images[${index}]` }
  if (!isPlainObject(raw)) {
    childCtx.issues.push(`${childCtx.path}: must be an object`)
    return null
  }
  const path = requireString(childCtx, raw.path, 'path')
  const alt = optionalLocalizedString(childCtx, raw.alt, 'alt')
  if (!path) return null
  return { path, alt }
}

function validateDatasheet(
  ctx: ValidationContext,
  raw: unknown,
  index: number,
): ManifestDatasheet | null {
  const childCtx: ValidationContext = {
    issues: ctx.issues,
    path: `${ctx.path}.datasheets[${index}]`,
  }
  if (!isPlainObject(raw)) {
    childCtx.issues.push(`${childCtx.path}: must be an object`)
    return null
  }
  const path = requireString(childCtx, raw.path, 'path')
  const title = requireLocalizedString(childCtx, raw.title, 'title')
  if (!path || !title) return null
  return { path, title }
}

function validatePhysical(
  ctx: ValidationContext,
  raw: unknown,
): ManifestPhysical | undefined {
  if (raw == null) return undefined
  if (!isPlainObject(raw)) {
    ctx.issues.push(`${ctx.path}.physical: must be an object`)
    return undefined
  }
  const childCtx: ValidationContext = { issues: ctx.issues, path: `${ctx.path}.physical` }
  return {
    weight: optionalNumber(childCtx, raw.weight, 'weight'),
    length: optionalNumber(childCtx, raw.length, 'length'),
    width: optionalNumber(childCtx, raw.width, 'width'),
    height: optionalNumber(childCtx, raw.height, 'height'),
  }
}

function validateSource(
  ctx: ValidationContext,
  raw: unknown,
): ManifestSourcePrice | null {
  const childCtx: ValidationContext = { issues: ctx.issues, path: `${ctx.path}.source` }
  if (!isPlainObject(raw)) {
    childCtx.issues.push(`${childCtx.path}: required object`)
    return null
  }
  const currency = raw.currency
  if (typeof currency !== 'string' || !isSourceCurrency(currency)) {
    childCtx.issues.push(
      `${childCtx.path}.currency: must be one of ${SOURCE_CURRENCY_VALUES.join(', ')}`,
    )
    return null
  }
  const amount = raw.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    childCtx.issues.push(`${childCtx.path}.amount: must be a positive finite number`)
    return null
  }
  const originSku = optionalString(childCtx, raw.originSku, 'originSku')
  return { currency, amount, originSku }
}

function validateProduct(
  ctx: ValidationContext,
  raw: unknown,
  index: number,
  seenSkus: Set<string>,
): ManifestProduct | null {
  const childCtx: ValidationContext = { issues: ctx.issues, path: `products[${index}]` }
  if (!isPlainObject(raw)) {
    childCtx.issues.push(`${childCtx.path}: must be an object`)
    return null
  }

  // SKU
  const skuRaw = raw.sku
  let sku: SKU | null = null
  if (typeof skuRaw !== 'string' || !SKU_RE.test(skuRaw)) {
    childCtx.issues.push(
      `${childCtx.path}.sku: must match ${SKU_RE.toString()} (got ${JSON.stringify(skuRaw)})`,
    )
  } else if (seenSkus.has(skuRaw)) {
    childCtx.issues.push(`${childCtx.path}.sku: duplicate SKU "${skuRaw}" in manifest`)
  } else {
    seenSkus.add(skuRaw)
    sku = toSku(skuRaw)
  }

  // Category
  const catRaw = raw.category
  let category: CategorySlug | null = null
  if (typeof catRaw !== 'string' || !CATEGORY_RE.test(catRaw)) {
    childCtx.issues.push(
      `${childCtx.path}.category: must match ${CATEGORY_RE.toString()} (got ${JSON.stringify(catRaw)})`,
    )
  } else {
    category = categorySlug(catRaw)
  }

  // Required localized strings
  const name = requireLocalizedString(childCtx, raw.name, 'name')
  const shortDescription = requireLocalizedString(childCtx, raw.shortDescription, 'shortDescription')

  // Source
  const source = validateSource(childCtx, raw.source)

  // Specs (optional)
  const specsRaw = raw.specs
  let specs: ManifestSpec[] = []
  if (specsRaw != null) {
    if (!Array.isArray(specsRaw)) {
      childCtx.issues.push(`${childCtx.path}.specs: must be an array`)
    } else {
      specs = specsRaw
        .map((s, i) => validateSpec(childCtx, s, i))
        .filter((s): s is ManifestSpec => s !== null)
    }
  }

  // Images (required, ≥1)
  const imagesRaw = raw.images
  let images: ManifestImage[] = []
  if (!Array.isArray(imagesRaw) || imagesRaw.length === 0) {
    childCtx.issues.push(`${childCtx.path}.images: required array with at least one image`)
  } else {
    images = imagesRaw
      .map((img, i) => validateImage(childCtx, img, i))
      .filter((img): img is ManifestImage => img !== null)
    if (images.length === 0) {
      childCtx.issues.push(`${childCtx.path}.images: no valid images after validation`)
    }
  }

  // Datasheets (optional)
  const datasheetsRaw = raw.datasheets
  let datasheets: ManifestDatasheet[] = []
  if (datasheetsRaw != null) {
    if (!Array.isArray(datasheetsRaw)) {
      childCtx.issues.push(`${childCtx.path}.datasheets: must be an array`)
    } else {
      datasheets = datasheetsRaw
        .map((d, i) => validateDatasheet(childCtx, d, i))
        .filter((d): d is ManifestDatasheet => d !== null)
    }
  }

  const physical = validatePhysical(childCtx, raw.physical)
  const brand = optionalString(childCtx, raw.brand, 'brand')

  // Locked flag (optional)
  let importLocked = false
  if (raw.importLocked != null) {
    if (typeof raw.importLocked !== 'boolean') {
      childCtx.issues.push(`${childCtx.path}.importLocked: must be a boolean`)
    } else {
      importLocked = raw.importLocked
    }
  }

  if (!sku || !category || !name || !shortDescription || !source) return null

  return {
    sku,
    category,
    brand,
    name,
    shortDescription,
    source,
    specs,
    physical,
    images,
    datasheets,
    importLocked,
  }
}

function validateDefaults(ctx: ValidationContext, raw: unknown): ManifestDefaults {
  if (raw == null) return DEFAULT_DEFAULTS
  if (!isPlainObject(raw)) {
    ctx.issues.push('defaults: must be an object')
    return DEFAULT_DEFAULTS
  }
  const childCtx: ValidationContext = { issues: ctx.issues, path: 'defaults' }

  let tvaRate: TVARate = DEFAULT_DEFAULTS.tvaRate
  if (raw.tvaRate != null) {
    const t = String(raw.tvaRate).toLowerCase()
    if (t === 'standard') tvaRate = TVARates.Standard
    else if (t === 'intermediate') tvaRate = TVARates.Intermediate
    else if (t === 'reduced') tvaRate = TVARates.Reduced
    else childCtx.issues.push('defaults.tvaRate: must be standard | intermediate | reduced')
  }

  const trackStock =
    typeof raw.trackStock === 'boolean' ? raw.trackStock : DEFAULT_DEFAULTS.trackStock
  const lowStockThreshold =
    typeof raw.lowStockThreshold === 'number' && Number.isFinite(raw.lowStockThreshold)
      ? raw.lowStockThreshold
      : DEFAULT_DEFAULTS.lowStockThreshold
  const initialStock =
    typeof raw.initialStock === 'number' && Number.isFinite(raw.initialStock)
      ? raw.initialStock
      : DEFAULT_DEFAULTS.initialStock

  let status: ProductStatus = DEFAULT_DEFAULTS.status
  if (raw.status != null) {
    const s = String(raw.status)
    if (s === 'draft') status = ProductStatuses.Draft
    else if (s === 'published') status = ProductStatuses.Published
    else if (s === 'outOfStock') status = ProductStatuses.OutOfStock
    else if (s === 'archived') status = ProductStatuses.Archived
    else childCtx.issues.push('defaults.status: must be draft | published | outOfStock | archived')
  }

  return { tvaRate, trackStock, lowStockThreshold, initialStock, status }
}

/**
 * Parse and validate a YAML supplier manifest. Throws {@link ManifestValidationError}
 * with all collected issues if anything is wrong.
 */
export function loadManifest(yamlText: string): SupplierManifest {
  let parsed: unknown
  try {
    parsed = parseYaml(yamlText)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new ManifestValidationError([`yaml parse error: ${message}`])
  }

  const issues: string[] = []
  const ctx: ValidationContext = { issues, path: '' }

  if (!isPlainObject(parsed)) {
    throw new ManifestValidationError(['root: must be a mapping'])
  }

  if (parsed.version !== 1) {
    issues.push(`version: must be exactly 1 (got ${JSON.stringify(parsed.version)})`)
  }

  // Supplier
  let supplierName = ''
  let supplierReference = ''
  if (!isPlainObject(parsed.supplier)) {
    issues.push('supplier: required object with { name, reference }')
  } else {
    const supplierCtx: ValidationContext = { issues, path: 'supplier' }
    supplierName = requireString(supplierCtx, parsed.supplier.name, 'name') ?? ''
    const ref = requireString(supplierCtx, parsed.supplier.reference, 'reference')
    if (ref) {
      if (!REFERENCE_RE.test(ref)) {
        issues.push(`supplier.reference: must match ${REFERENCE_RE.toString()} (got "${ref}")`)
      } else {
        supplierReference = ref
      }
    }
  }

  // Defaults
  const defaults = validateDefaults(ctx, parsed.defaults)

  // Products
  const productsRaw = parsed.products
  const products: ManifestProduct[] = []
  if (!Array.isArray(productsRaw) || productsRaw.length === 0) {
    issues.push('products: required non-empty array')
  } else {
    const seenSkus = new Set<string>()
    for (let i = 0; i < productsRaw.length; i++) {
      const product = validateProduct(ctx, productsRaw[i], i, seenSkus)
      if (product) products.push(product)
    }
  }

  if (issues.length > 0) {
    throw new ManifestValidationError(issues)
  }

  return {
    version: 1,
    supplier: { name: supplierName, reference: supplierReference },
    defaults,
    products,
  }
}

export async function loadManifestFromFile(filePath: string): Promise<SupplierManifest> {
  const text = await readFile(filePath, 'utf8')
  return loadManifest(text)
}
