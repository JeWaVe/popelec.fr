import { describe, it, expect } from 'vitest'
import { TVARates, TVA_RATE_VALUES, tvaRateToMultiplier } from '@/types/enums/tva-rate'

describe('TVARates', () => {
  it('has correct values', () => {
    expect(TVARates.Standard).toBe('20')
    expect(TVARates.Intermediate).toBe('10')
    expect(TVARates.Reduced).toBe('5.5')
  })
})

describe('TVA_RATE_VALUES', () => {
  it('contains all rates', () => {
    expect(TVA_RATE_VALUES).toContain('20')
    expect(TVA_RATE_VALUES).toContain('10')
    expect(TVA_RATE_VALUES).toContain('5.5')
    expect(TVA_RATE_VALUES).toHaveLength(3)
  })
})

describe('tvaRateToMultiplier', () => {
  it('converts 20% rate', () => {
    expect(tvaRateToMultiplier(TVARates.Standard)).toBeCloseTo(0.2)
  })

  it('converts 10% rate', () => {
    expect(tvaRateToMultiplier(TVARates.Intermediate)).toBeCloseTo(0.1)
  })

  it('converts 5.5% rate', () => {
    expect(tvaRateToMultiplier(TVARates.Reduced)).toBeCloseTo(0.055)
  })
})
