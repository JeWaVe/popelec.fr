declare const __brand: unique symbol

/**
 * Zero-runtime-cost branded type.
 * Prevents accidental mixing of structurally identical primitives.
 *
 * @example
 *   type PriceCents = Brand<number, 'PriceCents'>
 *   type Quantity   = Brand<number, 'Quantity'>
 *   // PriceCents is NOT assignable to Quantity, even though both are numbers.
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B }
