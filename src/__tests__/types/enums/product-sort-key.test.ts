import { describe, it, expect } from 'vitest'
import { ProductSortKeys, isProductSortKey } from '@/types/enums/product-sort-key'

describe('isProductSortKey', () => {
  it('returns true for valid sort keys', () => {
    expect(isProductSortKey('newest')).toBe(true)
    expect(isProductSortKey('priceAsc')).toBe(true)
    expect(isProductSortKey('priceDesc')).toBe(true)
    expect(isProductSortKey('name')).toBe(true)
  })

  it('returns false for invalid values', () => {
    expect(isProductSortKey('invalid')).toBe(false)
    expect(isProductSortKey('')).toBe(false)
    expect(isProductSortKey(null)).toBe(false)
    expect(isProductSortKey(42)).toBe(false)
  })
})

describe('ProductSortKeys', () => {
  it('has correct values', () => {
    expect(ProductSortKeys.Newest).toBe('newest')
    expect(ProductSortKeys.PriceAsc).toBe('priceAsc')
    expect(ProductSortKeys.PriceDesc).toBe('priceDesc')
    expect(ProductSortKeys.Name).toBe('name')
  })
})
