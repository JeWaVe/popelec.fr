export const ProductSortKeys = {
  Newest: 'newest',
  PriceAsc: 'priceAsc',
  PriceDesc: 'priceDesc',
  Name: 'name',
} as const

export type ProductSortKey = (typeof ProductSortKeys)[keyof typeof ProductSortKeys]

export const PRODUCT_SORT_KEY_VALUES = Object.values(ProductSortKeys) as unknown as readonly ProductSortKey[]

export function isProductSortKey(value: unknown): value is ProductSortKey {
  return typeof value === 'string' && (PRODUCT_SORT_KEY_VALUES as readonly string[]).includes(value)
}
