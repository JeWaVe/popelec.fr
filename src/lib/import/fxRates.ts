import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { type FxRates, SourceCurrencies } from '@/lib/import/pricing'

export interface FxRateProvider {
  /** Returns EUR-base rates: how many EUR per 1 unit of each source currency. */
  getRates(): Promise<FxRates>
  /** Identifier for audit logging. */
  describe(): string
}

/**
 * Hardcoded fallback rates. Roughly accurate as of early 2026; intended for
 * offline test runs and CI, not for production pricing.
 */
export const STATIC_FALLBACK_RATES: FxRates = {
  [SourceCurrencies.USD]: 0.92,
  [SourceCurrencies.CNY]: 0.13,
  [SourceCurrencies.EUR]: 1,
}

export class StaticFxRateProvider implements FxRateProvider {
  constructor(private readonly rates: FxRates = STATIC_FALLBACK_RATES) {}

  async getRates(): Promise<FxRates> {
    return this.rates
  }

  describe(): string {
    return 'static-fallback'
  }
}

/**
 * Fetches live rates from the free `exchangerate.host` API. Caches results
 * for 24h on disk so repeated dry-runs are fast and resilient to API hiccups.
 *
 * Falls back to the cached values if the API call fails and a cache exists.
 */
export class ExchangeRateHostProvider implements FxRateProvider {
  private readonly cachePath: string
  private readonly ttlMs: number

  constructor(opts: { cachePath?: string; ttlMs?: number } = {}) {
    this.cachePath = resolve(opts.cachePath ?? '.cache/fx-rates.json')
    this.ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000
  }

  async getRates(): Promise<FxRates> {
    const cached = await this.readCache()
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
      return cached.rates
    }

    try {
      const fresh = await this.fetchLive()
      await this.writeCache(fresh)
      return fresh
    } catch (err) {
      if (cached) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(
          `[fx] live fetch failed (${message}), using stale cache from ${new Date(cached.fetchedAt).toISOString()}`,
        )
        return cached.rates
      }
      throw err
    }
  }

  describe(): string {
    return `exchangerate.host (cache ${this.cachePath})`
  }

  private async fetchLive(): Promise<FxRates> {
    // exchangerate.host: GET /latest?base=EUR&symbols=USD,CNY
    // Returns: { base: "EUR", rates: { USD: 1.087, CNY: 7.69 } }
    // Those rates mean 1 EUR = X (foreign) — we need the inverse to get
    // "EUR per 1 unit of foreign currency".
    const url = 'https://api.exchangerate.host/latest?base=EUR&symbols=USD,CNY'
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      throw new Error(`exchangerate.host returned HTTP ${res.status}`)
    }
    const data = (await res.json()) as { rates?: Record<string, number> }
    const usdPerEur = data.rates?.USD
    const cnyPerEur = data.rates?.CNY
    if (
      typeof usdPerEur !== 'number' ||
      !Number.isFinite(usdPerEur) ||
      usdPerEur <= 0 ||
      typeof cnyPerEur !== 'number' ||
      !Number.isFinite(cnyPerEur) ||
      cnyPerEur <= 0
    ) {
      throw new Error(`exchangerate.host returned malformed payload: ${JSON.stringify(data)}`)
    }
    return {
      [SourceCurrencies.USD]: 1 / usdPerEur,
      [SourceCurrencies.CNY]: 1 / cnyPerEur,
      [SourceCurrencies.EUR]: 1,
    }
  }

  private async readCache(): Promise<{ fetchedAt: number; rates: FxRates } | null> {
    try {
      const text = await readFile(this.cachePath, 'utf8')
      const parsed = JSON.parse(text) as { fetchedAt: number; rates: FxRates }
      if (
        typeof parsed.fetchedAt === 'number' &&
        parsed.rates &&
        typeof parsed.rates[SourceCurrencies.USD] === 'number' &&
        typeof parsed.rates[SourceCurrencies.CNY] === 'number'
      ) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  }

  private async writeCache(rates: FxRates): Promise<void> {
    await mkdir(dirname(this.cachePath), { recursive: true })
    await writeFile(
      this.cachePath,
      JSON.stringify({ fetchedAt: Date.now(), rates }, null, 2),
      'utf8',
    )
  }
}
