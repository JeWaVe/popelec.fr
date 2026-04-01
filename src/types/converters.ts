import type { DomainCartItem } from './cart'
import type { CartProductId } from './cart'
import type { PriceCents } from './money'
import type { ProductSlug, SKU, ImageUrl } from './strings'
import type { TVARate } from './enums/tva-rate'
import { TVA_RATE_VALUES } from './enums/tva-rate'

/**
 * Re-brand cart items after JSON.parse from localStorage.
 * This is the localStorage → domain boundary converter.
 */
export function cartItemsFromJSON(raw: unknown): DomainCartItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item: unknown) => {
    const obj = item as Record<string, unknown>
    const rawTva = String(obj.tvaRate ?? '20')
    const tvaRate = (TVA_RATE_VALUES as readonly string[]).includes(rawTva)
      ? (rawTva as TVARate)
      : ('20' as TVARate)
    return {
      productId: String(obj.productId ?? '') as CartProductId,
      name: String(obj.name ?? ''),
      slug: String(obj.slug ?? '') as ProductSlug,
      sku: String(obj.sku ?? '') as SKU,
      priceHT: Number(obj.priceHT ?? 0) as PriceCents,
      tvaRate,
      quantity: Number(obj.quantity ?? 1),
      ...(obj.image ? { image: String(obj.image) as ImageUrl } : {}),
    }
  })
}
