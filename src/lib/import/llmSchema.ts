import { isSourceCurrency, type SourceCurrency } from '@/lib/import/pricing'
import { type LocalizedString } from '@/lib/import/manifest'

/**
 * JSON schema + hand-rolled validator for the LLM-extracted candidate
 * payload. We deliberately avoid `zod` (consistent with manifest.ts) and
 * collect all errors instead of bailing on the first one.
 */

export interface ExtractedSpec {
  readonly label: LocalizedString
  readonly value: LocalizedString
  readonly unit?: string
  readonly group?: string
}

export interface ExtractedImageRef {
  readonly path: string
  readonly alt?: LocalizedString
}

export interface ExtractedDatasheetRef {
  readonly path: string
  readonly title?: LocalizedString
}

export interface ExtractedCandidate {
  readonly proposedSku: string
  readonly proposedName: LocalizedString
  readonly proposedShortDescription: LocalizedString
  readonly proposedCategorySlug: string
  readonly proposedBrand?: string
  readonly proposedSourceCurrency: SourceCurrency
  readonly proposedSourceAmount: number
  readonly proposedSpecs: readonly ExtractedSpec[]
  readonly proposedImagePaths: readonly ExtractedImageRef[]
  readonly proposedDatasheetPaths: readonly ExtractedDatasheetRef[]
}

export interface ExtractedPayload {
  readonly candidates: readonly ExtractedCandidate[]
}

export class ExtractedPayloadValidationError extends Error {
  readonly issues: readonly string[]
  constructor(issues: readonly string[]) {
    super(`LLM payload validation failed:\n  - ${issues.join('\n  - ')}`)
    this.name = 'ExtractedPayloadValidationError'
    this.issues = issues
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pushIssue(issues: string[], path: string, message: string): void {
  issues.push(`${path}: ${message}`)
}

function parseLocalizedString(
  raw: unknown,
  issues: string[],
  path: string,
): LocalizedString | null {
  if (!isPlainObject(raw)) {
    pushIssue(issues, path, 'must be an object with { fr, en }')
    return null
  }
  const fr = raw.fr
  const en = raw.en
  if (typeof fr !== 'string' || fr.trim() === '') {
    pushIssue(issues, `${path}.fr`, 'required non-empty string')
    return null
  }
  if (typeof en !== 'string' || en.trim() === '') {
    pushIssue(issues, `${path}.en`, 'required non-empty string')
    return null
  }
  return { fr, en }
}

function parseOptionalLocalizedString(
  raw: unknown,
  issues: string[],
  path: string,
): LocalizedString | undefined {
  if (raw == null) return undefined
  const result = parseLocalizedString(raw, issues, path)
  return result ?? undefined
}

function parseSpec(raw: unknown, issues: string[], path: string): ExtractedSpec | null {
  if (!isPlainObject(raw)) {
    pushIssue(issues, path, 'must be an object')
    return null
  }
  const label = parseLocalizedString(raw.label, issues, `${path}.label`)
  const value = parseLocalizedString(raw.value, issues, `${path}.value`)
  if (!label || !value) return null
  const unit = typeof raw.unit === 'string' ? raw.unit : undefined
  const group = typeof raw.group === 'string' ? raw.group : undefined
  return { label, value, unit, group }
}

function parseImageRef(raw: unknown, issues: string[], path: string): ExtractedImageRef | null {
  if (!isPlainObject(raw)) {
    pushIssue(issues, path, 'must be an object')
    return null
  }
  if (typeof raw.path !== 'string' || raw.path.trim() === '') {
    pushIssue(issues, `${path}.path`, 'required non-empty string')
    return null
  }
  const alt = parseOptionalLocalizedString(raw.alt, issues, `${path}.alt`)
  return { path: raw.path, alt }
}

function parseDatasheetRef(
  raw: unknown,
  issues: string[],
  path: string,
): ExtractedDatasheetRef | null {
  if (!isPlainObject(raw)) {
    pushIssue(issues, path, 'must be an object')
    return null
  }
  if (typeof raw.path !== 'string' || raw.path.trim() === '') {
    pushIssue(issues, `${path}.path`, 'required non-empty string')
    return null
  }
  const title = parseOptionalLocalizedString(raw.title, issues, `${path}.title`)
  return { path: raw.path, title }
}

function parseCandidate(
  raw: unknown,
  issues: string[],
  index: number,
): ExtractedCandidate | null {
  const path = `candidates[${index}]`
  if (!isPlainObject(raw)) {
    pushIssue(issues, path, 'must be an object')
    return null
  }

  const proposedSku =
    typeof raw.proposedSku === 'string' && raw.proposedSku.trim() !== ''
      ? raw.proposedSku
      : null
  if (!proposedSku) {
    pushIssue(issues, `${path}.proposedSku`, 'required non-empty string')
  }

  const name = parseLocalizedString(raw.proposedName, issues, `${path}.proposedName`)
  const shortDescription = parseLocalizedString(
    raw.proposedShortDescription,
    issues,
    `${path}.proposedShortDescription`,
  )

  const categorySlug =
    typeof raw.proposedCategorySlug === 'string' && raw.proposedCategorySlug.trim() !== ''
      ? raw.proposedCategorySlug.toLowerCase()
      : null
  if (!categorySlug) {
    pushIssue(issues, `${path}.proposedCategorySlug`, 'required non-empty string')
  }

  const brand = typeof raw.proposedBrand === 'string' ? raw.proposedBrand : undefined

  const currencyRaw =
    typeof raw.proposedSourceCurrency === 'string'
      ? raw.proposedSourceCurrency.toUpperCase()
      : ''
  let currency: SourceCurrency | null = null
  if (!isSourceCurrency(currencyRaw)) {
    pushIssue(issues, `${path}.proposedSourceCurrency`, 'must be USD, CNY, or EUR')
  } else {
    currency = currencyRaw
  }

  const amountRaw = raw.proposedSourceAmount
  let amount: number | null = null
  if (typeof amountRaw !== 'number' || !Number.isFinite(amountRaw) || amountRaw <= 0) {
    pushIssue(issues, `${path}.proposedSourceAmount`, 'must be a positive finite number')
  } else {
    amount = amountRaw
  }

  // Specs (optional)
  const specs: ExtractedSpec[] = []
  if (raw.proposedSpecs != null) {
    if (!Array.isArray(raw.proposedSpecs)) {
      pushIssue(issues, `${path}.proposedSpecs`, 'must be an array')
    } else {
      for (let i = 0; i < raw.proposedSpecs.length; i++) {
        const s = parseSpec(raw.proposedSpecs[i], issues, `${path}.proposedSpecs[${i}]`)
        if (s) specs.push(s)
      }
    }
  }

  // Image paths (required, ≥1)
  const imagePaths: ExtractedImageRef[] = []
  if (!Array.isArray(raw.proposedImagePaths) || raw.proposedImagePaths.length === 0) {
    pushIssue(issues, `${path}.proposedImagePaths`, 'required array with at least one image')
  } else {
    for (let i = 0; i < raw.proposedImagePaths.length; i++) {
      const img = parseImageRef(
        raw.proposedImagePaths[i],
        issues,
        `${path}.proposedImagePaths[${i}]`,
      )
      if (img) imagePaths.push(img)
    }
  }

  // Datasheet paths (optional)
  const datasheetPaths: ExtractedDatasheetRef[] = []
  if (raw.proposedDatasheetPaths != null) {
    if (!Array.isArray(raw.proposedDatasheetPaths)) {
      pushIssue(issues, `${path}.proposedDatasheetPaths`, 'must be an array')
    } else {
      for (let i = 0; i < raw.proposedDatasheetPaths.length; i++) {
        const ds = parseDatasheetRef(
          raw.proposedDatasheetPaths[i],
          issues,
          `${path}.proposedDatasheetPaths[${i}]`,
        )
        if (ds) datasheetPaths.push(ds)
      }
    }
  }

  if (
    !proposedSku ||
    !name ||
    !shortDescription ||
    !categorySlug ||
    !currency ||
    amount === null ||
    imagePaths.length === 0
  ) {
    return null
  }

  return {
    proposedSku,
    proposedName: name,
    proposedShortDescription: shortDescription,
    proposedCategorySlug: categorySlug,
    proposedBrand: brand,
    proposedSourceCurrency: currency,
    proposedSourceAmount: amount,
    proposedSpecs: specs,
    proposedImagePaths: imagePaths,
    proposedDatasheetPaths: datasheetPaths,
  }
}

/**
 * Validate the JSON returned by the LLM. Throws {@link ExtractedPayloadValidationError}
 * with a list of all collected issues if anything is wrong.
 */
export function parseExtractedPayload(raw: unknown): ExtractedPayload {
  const issues: string[] = []

  if (!isPlainObject(raw)) {
    throw new ExtractedPayloadValidationError(['root: must be an object'])
  }
  if (!Array.isArray(raw.candidates)) {
    throw new ExtractedPayloadValidationError(['candidates: required array'])
  }

  const candidates: ExtractedCandidate[] = []
  for (let i = 0; i < raw.candidates.length; i++) {
    const c = parseCandidate(raw.candidates[i], issues, i)
    if (c) candidates.push(c)
  }

  if (issues.length > 0) {
    throw new ExtractedPayloadValidationError(issues)
  }

  return { candidates }
}

/** JSON schema string we pass to the Claude CLI for response validation. */
export const EXTRACTED_PAYLOAD_JSON_SCHEMA = JSON.stringify({
  type: 'object',
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'proposedSku',
          'proposedName',
          'proposedShortDescription',
          'proposedCategorySlug',
          'proposedSourceCurrency',
          'proposedSourceAmount',
          'proposedImagePaths',
        ],
        properties: {
          proposedSku: { type: 'string', minLength: 1 },
          proposedName: {
            type: 'object',
            required: ['fr', 'en'],
            properties: {
              fr: { type: 'string', minLength: 1 },
              en: { type: 'string', minLength: 1 },
            },
          },
          proposedShortDescription: {
            type: 'object',
            required: ['fr', 'en'],
            properties: {
              fr: { type: 'string', minLength: 1 },
              en: { type: 'string', minLength: 1 },
            },
          },
          proposedCategorySlug: { type: 'string', minLength: 1 },
          proposedBrand: { type: 'string' },
          proposedSourceCurrency: { type: 'string', enum: ['USD', 'CNY', 'EUR'] },
          proposedSourceAmount: { type: 'number', exclusiveMinimum: 0 },
          proposedSpecs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'value'],
              properties: {
                label: {
                  type: 'object',
                  required: ['fr', 'en'],
                  properties: { fr: { type: 'string' }, en: { type: 'string' } },
                },
                value: {
                  type: 'object',
                  required: ['fr', 'en'],
                  properties: { fr: { type: 'string' }, en: { type: 'string' } },
                },
                unit: { type: 'string' },
                group: { type: 'string' },
              },
            },
          },
          proposedImagePaths: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['path'],
              properties: {
                path: { type: 'string', minLength: 1 },
                alt: {
                  type: 'object',
                  properties: { fr: { type: 'string' }, en: { type: 'string' } },
                },
              },
            },
          },
          proposedDatasheetPaths: {
            type: 'array',
            items: {
              type: 'object',
              required: ['path'],
              properties: {
                path: { type: 'string', minLength: 1 },
                title: {
                  type: 'object',
                  properties: { fr: { type: 'string' }, en: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
  },
})
