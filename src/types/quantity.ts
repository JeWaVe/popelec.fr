import type { Brand } from './brand'

/** Non-negative stock / order quantity. */
export type Quantity = Brand<number, 'Quantity'>

export function quantity(raw: number): Quantity {
  return raw as Quantity
}

/** Display ordering for categories. */
export type SortOrder = Brand<number, 'SortOrder'>

export function sortOrder(raw: number): SortOrder {
  return raw as SortOrder
}
