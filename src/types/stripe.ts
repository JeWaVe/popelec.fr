import type { Brand } from './brand'

export type StripeProductId = Brand<string, 'StripeProductId'>
export type StripePriceId = Brand<string, 'StripePriceId'>
export type StripeCustomerId = Brand<string, 'StripeCustomerId'>
export type StripePaymentIntentId = Brand<string, 'StripePaymentIntentId'>
export type StripeCheckoutSessionId = Brand<string, 'StripeCheckoutSessionId'>

export function stripeProductId(raw: string): StripeProductId {
  return raw as StripeProductId
}
export function stripePriceId(raw: string): StripePriceId {
  return raw as StripePriceId
}
export function stripeCustomerId(raw: string): StripeCustomerId {
  return raw as StripeCustomerId
}
export function stripePaymentIntentId(raw: string): StripePaymentIntentId {
  return raw as StripePaymentIntentId
}
export function stripeCheckoutSessionId(raw: string): StripeCheckoutSessionId {
  return raw as StripeCheckoutSessionId
}
