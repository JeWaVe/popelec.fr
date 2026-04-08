import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { enumToPayloadOptions } from '@/types/payload-options'
import { SOURCE_CURRENCY_VALUES, type SourceCurrency } from '@/lib/import/pricing'

export const ProductCandidateStatuses = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Skipped: 'skipped',
  Error: 'error',
} as const

export type ProductCandidateStatus =
  (typeof ProductCandidateStatuses)[keyof typeof ProductCandidateStatuses]

const STATUS_LABELS: Record<ProductCandidateStatus, string> = {
  [ProductCandidateStatuses.Pending]: 'En attente',
  [ProductCandidateStatuses.Confirmed]: 'Confirmé',
  [ProductCandidateStatuses.Skipped]: 'Ignoré',
  [ProductCandidateStatuses.Error]: 'Erreur',
}

const CURRENCY_LABELS: Record<SourceCurrency, string> = {
  USD: 'USD ($)',
  CNY: 'CNY (\u00a5)',
  EUR: 'EUR (\u20ac)',
}

export const ProductCandidates: CollectionConfig = {
  slug: 'product-candidates',
  admin: {
    useAsTitle: 'proposedName',
    defaultColumns: ['proposedSku', 'proposedName', 'status', 'session'],
    group: 'Commerce',
    description: 'Produits candidats détectés par le scan LLM, en attente de revue',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'session',
      type: 'relationship',
      relationTo: 'import-sessions',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'index',
      type: 'number',
      required: true,
      admin: {
        position: 'sidebar',
        description: 'Position dans l\u2019ordre du wizard',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: ProductCandidateStatuses.Pending,
      options: enumToPayloadOptions(STATUS_LABELS),
      admin: { position: 'sidebar' },
    },
    {
      name: 'proposedSku',
      type: 'text',
      required: true,
    },
    {
      name: 'proposedName',
      type: 'text',
      required: true,
    },
    {
      name: 'proposedNameEn',
      type: 'text',
    },
    {
      name: 'proposedShortDescription',
      type: 'textarea',
    },
    {
      name: 'proposedShortDescriptionEn',
      type: 'textarea',
    },
    {
      name: 'proposedCategorySlug',
      type: 'text',
    },
    {
      name: 'proposedBrand',
      type: 'text',
    },
    {
      name: 'proposedSourceCurrency',
      type: 'select',
      options: enumToPayloadOptions(CURRENCY_LABELS),
      defaultValue: 'USD',
    },
    {
      name: 'proposedSourceAmount',
      type: 'number',
      min: 0,
    },
    {
      name: 'proposedSpecsJson',
      type: 'textarea',
      admin: {
        description:
          'JSON: array of { label:{fr,en}, value:{fr,en}, unit?, group? }',
      },
    },
    {
      name: 'proposedImagePaths',
      type: 'array',
      fields: [
        { name: 'path', type: 'text', required: true },
        { name: 'altFr', type: 'text' },
        { name: 'altEn', type: 'text' },
      ],
    },
    {
      name: 'proposedDatasheetPaths',
      type: 'array',
      fields: [
        { name: 'path', type: 'text', required: true },
        { name: 'titleFr', type: 'text' },
        { name: 'titleEn', type: 'text' },
      ],
    },
    {
      name: 'confirmedProduct',
      type: 'relationship',
      relationTo: 'products',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'errorMessage',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'reviewedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}

// Validate that label values match SOURCE_CURRENCY_VALUES at compile-time
// (catches drift if a new currency is added).
const _currencyKeysCheck: ReadonlyArray<SourceCurrency> = SOURCE_CURRENCY_VALUES
void _currencyKeysCheck
