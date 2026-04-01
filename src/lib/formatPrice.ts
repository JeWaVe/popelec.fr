import type { PriceCents } from '@/types/money'
import { priceCents } from '@/types/money'
import type { Locale } from '@/types/enums/locale'
import type { TVARate } from '@/types/enums/tva-rate'
import { tvaRateToMultiplier, TVARates } from '@/types/enums/tva-rate'

/**
 * Format a price in cents to a display string.
 * @param cents Price in cents (e.g., 10000 = 100.00 EUR)
 * @param locale 'fr' or 'en'
 */
export function formatPrice(cents: PriceCents, locale: Locale = 'fr'): string {
  const amount = cents / 100
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Calculate TTC price from HT price + TVA rate.
 * @param priceHT Price HT in cents
 * @param tvaRate TVA rate as enum value ('20', '10', '5.5')
 * @returns Price TTC in cents
 */
export function calculateTTC(priceHT: PriceCents, tvaRate: TVARate = TVARates.Standard): PriceCents {
  const rate = tvaRateToMultiplier(tvaRate)
  return priceCents(Math.round(priceHT * (1 + rate)))
}
