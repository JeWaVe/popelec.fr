import { describe, it, expect } from 'vitest'
import { StaticFxRateProvider, STATIC_FALLBACK_RATES } from '@/lib/import/fxRates'
import { SourceCurrencies } from '@/lib/import/pricing'

describe('StaticFxRateProvider', () => {
  it('returns the default fallback rates', async () => {
    const p = new StaticFxRateProvider()
    const rates = await p.getRates()
    expect(rates[SourceCurrencies.USD]).toBe(STATIC_FALLBACK_RATES[SourceCurrencies.USD])
    expect(rates[SourceCurrencies.CNY]).toBe(STATIC_FALLBACK_RATES[SourceCurrencies.CNY])
    expect(rates[SourceCurrencies.EUR]).toBe(1)
  })

  it('returns custom rates when provided', async () => {
    const p = new StaticFxRateProvider({
      [SourceCurrencies.USD]: 0.5,
      [SourceCurrencies.CNY]: 0.1,
      [SourceCurrencies.EUR]: 1,
    })
    const rates = await p.getRates()
    expect(rates[SourceCurrencies.USD]).toBe(0.5)
  })

  it('describes itself', () => {
    expect(new StaticFxRateProvider().describe()).toBe('static-fallback')
  })
})
