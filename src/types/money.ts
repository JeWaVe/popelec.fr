import type { Brand } from './brand'

/** Price stored as integer cents to avoid floating-point errors. */
export type PriceCents = Brand<number, 'PriceCents'>

export function priceCents(raw: number): PriceCents {
  return raw as PriceCents
}

export function eurosToCents(euros: number): PriceCents {
  return Math.round(euros * 100) as PriceCents
}
