import type { Brand } from './brand'
import type { PriceCents } from './money'
import type { ProductSlug, SKU, ImageUrl } from './strings'
import type { TVARate } from './enums/tva-rate'

/** Cart items use a stringified Payload ID as their key. */
export type CartProductId = Brand<string, 'CartProductId'>

export function cartProductId(raw: string): CartProductId {
  return raw as CartProductId
}

export interface DomainCartItem {
  productId: CartProductId
  name: string
  slug: ProductSlug
  sku: SKU
  priceHT: PriceCents
  tvaRate: TVARate
  quantity: number
  image?: ImageUrl
}

export interface DomainCartContext {
  items: DomainCartItem[]
  addItem: (item: Omit<DomainCartItem, 'quantity'>, quantity?: number) => void
  removeItem: (productId: CartProductId) => void
  updateQuantity: (productId: CartProductId, quantity: number) => void
  clearCart: () => void
  itemCount: number
  subtotalHT: PriceCents
}
