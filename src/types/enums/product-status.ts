export const ProductStatuses = {
  Draft: 'draft',
  Published: 'published',
  OutOfStock: 'outOfStock',
  Archived: 'archived',
} as const

export type ProductStatus = (typeof ProductStatuses)[keyof typeof ProductStatuses]

export const PRODUCT_STATUS_VALUES = Object.values(ProductStatuses) as unknown as readonly ProductStatus[]
