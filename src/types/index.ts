// --- Branded primitives ---
export type { Brand } from './brand'
export type { PayloadId } from './ids'
export { payloadId } from './ids'
export type { PriceCents } from './money'
export { priceCents, eurosToCents } from './money'
export type { Quantity, SortOrder } from './quantity'
export { quantity, sortOrder } from './quantity'
export type {
  ProductSlug, CategorySlug, PageSlug, SKU, OrderNumber,
  Email, Phone, SIRET, VATNumber, PostalCode, ImageUrl, ISODateString,
} from './strings'
export {
  productSlug, categorySlug, pageSlug, sku, orderNumber,
  email, phone, siret, vatNumber, postalCode, imageUrl, isoDateString,
} from './strings'
export type {
  StripeProductId, StripePriceId, StripeCustomerId,
  StripePaymentIntentId, StripeCheckoutSessionId,
} from './stripe'
export {
  stripeProductId, stripePriceId, stripeCustomerId,
  stripePaymentIntentId, stripeCheckoutSessionId,
} from './stripe'

// --- Enums ---
export * from './enums'

// --- Cart domain types ---
export type { DomainCartItem, DomainCartContext, CartProductId } from './cart'
export { cartProductId } from './cart'

// --- Boundary converters ---
export { cartItemsFromJSON } from './converters'

// --- Payload helpers ---
export { enumToPayloadOptions } from './payload-options'

// --- Type guards ---
export { isLocale, parseLocale, isProductSortKey } from './guards'
