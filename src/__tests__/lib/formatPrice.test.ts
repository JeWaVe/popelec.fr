import { describe, it, expect } from 'vitest'
import { formatPrice, calculateTTC } from '@/lib/formatPrice'
import { priceCents } from '@/types/money'
import { TVARates } from '@/types/enums/tva-rate'

describe('formatPrice', () => {
  it('formats price in French locale', () => {
    const result = formatPrice(priceCents(10000), 'fr')
    // Intl formats may use non-breaking space — normalize for comparison
    const normalized = result.replace(/\s/g, ' ')
    expect(normalized).toMatch(/100,00/)
    expect(normalized).toMatch(/€/)
  })

  it('formats price in English locale', () => {
    const result = formatPrice(priceCents(10000), 'en')
    expect(result).toMatch(/100\.00/)
    expect(result).toMatch(/€/)
  })

  it('formats zero', () => {
    const result = formatPrice(priceCents(0), 'fr')
    const normalized = result.replace(/\s/g, ' ')
    expect(normalized).toMatch(/0,00/)
  })

  it('formats small amounts', () => {
    const result = formatPrice(priceCents(1), 'fr')
    const normalized = result.replace(/\s/g, ' ')
    expect(normalized).toMatch(/0,01/)
  })

  it('formats large amounts', () => {
    const result = formatPrice(priceCents(999999), 'fr')
    const normalized = result.replace(/\s/g, ' ')
    expect(normalized).toMatch(/9 999,99/)
  })

  it('defaults to French locale', () => {
    const result = formatPrice(priceCents(5000))
    const normalized = result.replace(/\s/g, ' ')
    expect(normalized).toMatch(/50,00/)
  })
})

describe('calculateTTC', () => {
  it('calculates TTC with 20% TVA', () => {
    expect(calculateTTC(priceCents(10000), TVARates.Standard)).toBe(12000)
  })

  it('calculates TTC with 10% TVA', () => {
    expect(calculateTTC(priceCents(10000), TVARates.Intermediate)).toBe(11000)
  })

  it('calculates TTC with 5.5% TVA', () => {
    expect(calculateTTC(priceCents(10000), TVARates.Reduced)).toBe(10550)
  })

  it('defaults to 20% TVA', () => {
    expect(calculateTTC(priceCents(10000))).toBe(12000)
  })

  it('rounds correctly', () => {
    // 333 * 1.055 = 351.315 → rounds to 351
    expect(calculateTTC(priceCents(333), TVARates.Reduced)).toBe(351)
  })

  it('handles zero', () => {
    expect(calculateTTC(priceCents(0))).toBe(0)
  })
})
