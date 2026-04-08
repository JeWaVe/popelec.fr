import { type PriceCents, priceCents } from '@/types/money'

/**
 * Currencies the supplier may quote in. EUR is included as a passthrough so a
 * future supplier already invoicing in euros can be handled by the same code path.
 */
export const SourceCurrencies = {
  USD: 'USD',
  CNY: 'CNY',
  EUR: 'EUR',
} as const

export type SourceCurrency = (typeof SourceCurrencies)[keyof typeof SourceCurrencies]

export const SOURCE_CURRENCY_VALUES = Object.values(SourceCurrencies) as readonly SourceCurrency[]

export function isSourceCurrency(value: string): value is SourceCurrency {
  return (SOURCE_CURRENCY_VALUES as readonly string[]).includes(value)
}

/**
 * Exchange rates expressed as: how many EUR you get for 1 unit of the source
 * currency. So a USD→EUR rate of 0.92 means 1 USD = 0.92 EUR.
 *
 * EUR is always 1.0.
 */
export type FxRates = Readonly<Record<SourceCurrency, number>>

/**
 * Pricing policy applied on top of the FX-converted EUR cost.
 *
 * Final EUR price = sourceAmount × fxRate × (1 + landedCostFraction) × margin
 */
export interface PricingPolicy {
  /** Fraction added on top of the FX-converted price to model freight, customs, etc. */
  readonly landedCostFraction: number
  /** Multiplicative margin applied after landed cost. */
  readonly margin: number
}

export const DEFAULT_PRICING_POLICY: PricingPolicy = {
  landedCostFraction: 0.25,
  margin: 2.5,
}

/**
 * Convert an amount in a foreign currency into EUR (as a `number`, not cents).
 *
 * @throws if the amount is negative or NaN, or if the rate for the requested
 *   currency is missing/zero/negative.
 */
export function convertToEur(amount: number, currency: SourceCurrency, rates: FxRates): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`convertToEur: amount must be a non-negative finite number, got ${amount}`)
  }
  const rate = rates[currency]
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(
      `convertToEur: missing or invalid FX rate for ${currency} (got ${rate as unknown as string})`,
    )
  }
  return amount * rate
}

/**
 * Apply the landed-cost + margin policy on a EUR base price and return cents
 * (rounded to nearest integer).
 */
export function applyMargin(
  eur: number,
  policy: PricingPolicy = DEFAULT_PRICING_POLICY,
): PriceCents {
  if (!Number.isFinite(eur) || eur < 0) {
    throw new RangeError(`applyMargin: eur must be a non-negative finite number, got ${eur}`)
  }
  if (!Number.isFinite(policy.landedCostFraction) || policy.landedCostFraction < 0) {
    throw new RangeError(
      `applyMargin: landedCostFraction must be a non-negative number, got ${policy.landedCostFraction}`,
    )
  }
  if (!Number.isFinite(policy.margin) || policy.margin <= 0) {
    throw new RangeError(`applyMargin: margin must be > 0, got ${policy.margin}`)
  }
  const finalEur = eur * (1 + policy.landedCostFraction) * policy.margin
  return priceCents(Math.round(finalEur * 100))
}

/**
 * One-shot convenience: convert + apply policy. Returns price in cents.
 */
export function computeRetailPrice(
  amount: number,
  currency: SourceCurrency,
  rates: FxRates,
  policy: PricingPolicy = DEFAULT_PRICING_POLICY,
): PriceCents {
  const eur = convertToEur(amount, currency, rates)
  return applyMargin(eur, policy)
}
