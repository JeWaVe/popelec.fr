import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { ProductStatuses, type ProductStatus } from '@/types/enums/product-status'
import { TVARates, type TVARate } from '@/types/enums/tva-rate'
import { enumToPayloadOptions } from '@/types/payload-options'

const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  [ProductStatuses.Draft]: 'Brouillon',
  [ProductStatuses.Published]: 'Publié',
  [ProductStatuses.OutOfStock]: 'Rupture de stock',
  [ProductStatuses.Archived]: 'Archivé',
}

const TVA_RATE_LABELS: Record<TVARate, string> = {
  [TVARates.Standard]: '20%',
  [TVARates.Intermediate]: '10%',
  [TVARates.Reduced]: '5.5%',
}

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'sku', 'pricing.priceHT', 'stock.quantity', 'status'],
    group: 'Catalogue',
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  versions: { drafts: true },
  fields: [
    // --- Core ---
    {
      name: 'name',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'sku',
      type: 'text',
      required: true,
      unique: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: ProductStatuses.Draft,
      options: enumToPayloadOptions(PRODUCT_STATUS_LABELS),
      admin: { position: 'sidebar' },
    },

    // --- Descriptions ---
    {
      name: 'shortDescription',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'description',
      type: 'richText',
      localized: true,
    },

    // --- Pricing ---
    {
      name: 'pricing',
      type: 'group',
      label: 'Tarification',
      fields: [
        {
          name: 'priceHT',
          type: 'number',
          required: true,
          min: 0,
          admin: { description: 'Prix HT en centimes (ex: 10000 = 100,00 €)' },
        },
        {
          name: 'tvaRate',
          type: 'select',
          defaultValue: TVARates.Standard,
          options: enumToPayloadOptions(TVA_RATE_LABELS),
        },
        {
          name: 'proPrice',
          type: 'number',
          min: 0,
          admin: { description: 'Prix professionnel HT en centimes (optionnel)' },
        },
        {
          name: 'compareAtPrice',
          type: 'number',
          min: 0,
          admin: { description: 'Ancien prix HT pour afficher une promotion' },
        },
      ],
    },

    // --- Stock ---
    {
      name: 'stock',
      type: 'group',
      label: 'Stock',
      fields: [
        { name: 'quantity', type: 'number', defaultValue: 0, min: 0 },
        { name: 'lowStockThreshold', type: 'number', defaultValue: 5 },
        { name: 'trackStock', type: 'checkbox', defaultValue: true },
      ],
    },

    // --- Categories ---
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      required: true,
    },

    // --- Images ---
    {
      name: 'images',
      type: 'array',
      label: 'Images',
      minRows: 1,
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'alt', type: 'text', localized: true },
      ],
    },

    // --- Technical Specifications ---
    {
      name: 'specs',
      type: 'array',
      label: 'Caractéristiques techniques',
      fields: [
        { name: 'label', type: 'text', required: true, localized: true },
        { name: 'value', type: 'text', required: true, localized: true },
        { name: 'unit', type: 'text' },
        {
          name: 'group',
          type: 'text',
          admin: { description: 'Groupe (ex: Électrique, Mécanique, Dimensions)' },
        },
      ],
    },

    // --- Datasheets ---
    {
      name: 'datasheets',
      type: 'array',
      label: 'Fiches techniques',
      fields: [
        { name: 'title', type: 'text', required: true, localized: true },
        { name: 'file', type: 'upload', relationTo: 'media', required: true },
      ],
    },

    // --- Physical attributes ---
    {
      name: 'physical',
      type: 'group',
      label: 'Dimensions & Poids',
      fields: [
        { name: 'weight', type: 'number', admin: { description: 'Poids en kg' } },
        { name: 'length', type: 'number', admin: { description: 'Longueur en mm' } },
        { name: 'width', type: 'number', admin: { description: 'Largeur en mm' } },
        { name: 'height', type: 'number', admin: { description: 'Hauteur en mm' } },
      ],
    },

    // --- Stripe sync ---
    {
      name: 'stripeProductId',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'stripePriceId',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },

    // --- SEO ---
    {
      name: 'meta',
      type: 'group',
      label: 'SEO',
      fields: [
        { name: 'title', type: 'text', localized: true },
        { name: 'description', type: 'textarea', localized: true },
      ],
    },

    // --- Related products ---
    {
      name: 'relatedProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
    },
  ],
}
