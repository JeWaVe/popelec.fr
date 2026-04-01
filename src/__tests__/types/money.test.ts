import { describe, it, expect } from 'vitest'
import { priceCents, eurosToCents } from '@/types/money'

describe('priceCents', () => {
  it('brands a number as PriceCents', () => {
    const result = priceCents(1000)
    expect(result).toBe(1000)
  })

  it('preserves zero', () => {
    expect(priceCents(0)).toBe(0)
  })
})

describe('eurosToCents', () => {
  it('converts whole euros', () => {
    expect(eurosToCents(10)).toBe(1000)
  })

  it('converts euros with cents', () => {
    expect(eurosToCents(2.5)).toBe(250)
    expect(eurosToCents(0.99)).toBe(99)
  })

  it('rounds to nearest cent', () => {
    expect(eurosToCents(19.99)).toBe(1999)
    // 1.005 * 100 = 100.49999... due to IEEE 754, rounds to 100
    expect(eurosToCents(1.005)).toBe(100)
  })

  it('handles zero', () => {
    expect(eurosToCents(0)).toBe(0)
  })
})
