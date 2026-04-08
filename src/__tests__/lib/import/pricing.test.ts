import { describe, it, expect } from 'vitest'
import {
  applyMargin,
  computeRetailPrice,
  convertToEur,
  DEFAULT_PRICING_POLICY,
  isSourceCurrency,
  SourceCurrencies,
  type FxRates,
  type PricingPolicy,
} from '@/lib/import/pricing'

const RATES: FxRates = {
  [SourceCurrencies.USD]: 0.92,
  [SourceCurrencies.CNY]: 0.13,
  [SourceCurrencies.EUR]: 1,
}

describe('isSourceCurrency', () => {
  it('accepts known currencies', () => {
    expect(isSourceCurrency('USD')).toBe(true)
    expect(isSourceCurrency('CNY')).toBe(true)
    expect(isSourceCurrency('EUR')).toBe(true)
  })

  it('rejects unknown currencies', () => {
    expect(isSourceCurrency('GBP')).toBe(false)
    expect(isSourceCurrency('usd')).toBe(false)
    expect(isSourceCurrency('')).toBe(false)
  })
})

describe('convertToEur', () => {
  it('converts USD to EUR', () => {
    expect(convertToEur(100, SourceCurrencies.USD, RATES)).toBeCloseTo(92, 6)
  })

  it('converts CNY to EUR', () => {
    expect(convertToEur(100, SourceCurrencies.CNY, RATES)).toBeCloseTo(13, 6)
  })

  it('passes EUR through unchanged', () => {
    expect(convertToEur(100, SourceCurrencies.EUR, RATES)).toBe(100)
  })

  it('handles zero amount', () => {
    expect(convertToEur(0, SourceCurrencies.USD, RATES)).toBe(0)
  })

  it('throws on negative amount', () => {
    expect(() => convertToEur(-1, SourceCurrencies.USD, RATES)).toThrow(RangeError)
  })

  it('throws on NaN amount', () => {
    expect(() => convertToEur(Number.NaN, SourceCurrencies.USD, RATES)).toThrow(RangeError)
  })

  it('throws on missing rate', () => {
    const incomplete = { [SourceCurrencies.EUR]: 1 } as unknown as FxRates
    expect(() => convertToEur(100, SourceCurrencies.USD, incomplete)).toThrow(RangeError)
  })

  it('throws on zero rate', () => {
    const zero: FxRates = {
      [SourceCurrencies.USD]: 0,
      [SourceCurrencies.CNY]: 0.13,
      [SourceCurrencies.EUR]: 1,
    }
    expect(() => convertToEur(100, SourceCurrencies.USD, zero)).toThrow(RangeError)
  })

  it('throws on negative rate', () => {
    const negative: FxRates = {
      [SourceCurrencies.USD]: -0.92,
      [SourceCurrencies.CNY]: 0.13,
      [SourceCurrencies.EUR]: 1,
    }
    expect(() => convertToEur(100, SourceCurrencies.USD, negative)).toThrow(RangeError)
  })
})

describe('applyMargin', () => {
  it('applies the default policy: 100 EUR → 100 × 1.25 × 2.5 = 312.50 → 31250 cents', () => {
    expect(applyMargin(100)).toBe(31250)
  })

  it('rounds to nearest cent', () => {
    // 7.31 × 1.25 × 2.5 = 22.84375 → 22.84 → 2284 cents
    expect(applyMargin(7.31)).toBe(2284)
  })

  it('rounds half up', () => {
    // engineer the input so it lands on x.005 — pick raw=8 EUR with custom policy
    const policy: PricingPolicy = { landedCostFraction: 0, margin: 1 }
    expect(applyMargin(0.005, policy)).toBe(1) // 0.5 cent → rounds to 1
  })

  it('handles zero', () => {
    expect(applyMargin(0)).toBe(0)
  })

  it('respects a custom policy', () => {
    const policy: PricingPolicy = { landedCostFraction: 0.5, margin: 3 }
    // 10 × 1.5 × 3 = 45 → 4500 cents
    expect(applyMargin(10, policy)).toBe(4500)
  })

  it('throws on negative input', () => {
    expect(() => applyMargin(-1)).toThrow(RangeError)
  })

  it('throws on negative landed cost', () => {
    expect(() => applyMargin(10, { landedCostFraction: -0.1, margin: 2 })).toThrow(RangeError)
  })

  it('throws on zero margin', () => {
    expect(() => applyMargin(10, { landedCostFraction: 0.25, margin: 0 })).toThrow(RangeError)
  })

  it('throws on negative margin', () => {
    expect(() => applyMargin(10, { landedCostFraction: 0.25, margin: -1 })).toThrow(RangeError)
  })
})

describe('computeRetailPrice', () => {
  it('chains conversion + margin (USD)', () => {
    // 73 USD × 0.92 ≈ 67.16 EUR → × 1.25 × 2.5 ≈ 209.87 EUR → 20987 cents
    // (exact result depends on floating-point math, hence the spot value)
    expect(computeRetailPrice(73, SourceCurrencies.USD, RATES)).toBe(20987)
  })

  it('chains conversion + margin (CNY)', () => {
    // 854 CNY × 0.13 = 111.02 EUR → × 1.25 × 2.5 = 346.9375 → 34694 cents
    expect(computeRetailPrice(854, SourceCurrencies.CNY, RATES)).toBe(34694)
  })

  it('uses default policy when not provided', () => {
    expect(computeRetailPrice(100, SourceCurrencies.EUR, RATES)).toBe(applyMargin(100))
  })

  it('accepts a custom policy', () => {
    const policy: PricingPolicy = { landedCostFraction: 0, margin: 1 }
    expect(computeRetailPrice(100, SourceCurrencies.EUR, RATES, policy)).toBe(10000)
  })

  it('returns 0 for a zero amount', () => {
    expect(computeRetailPrice(0, SourceCurrencies.USD, RATES)).toBe(0)
  })

  it('exposes the default policy constants', () => {
    expect(DEFAULT_PRICING_POLICY.landedCostFraction).toBe(0.25)
    expect(DEFAULT_PRICING_POLICY.margin).toBe(2.5)
  })
})
