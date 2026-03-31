/**
 * Format a price in cents to a display string.
 * @param cents Price in cents (e.g., 10000 = 100.00 EUR)
 * @param locale 'fr' or 'en'
 */
export function formatPrice(cents: number, locale: string = 'fr'): string {
  const amount = cents / 100
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Calculate TTC price from HT price + TVA rate.
 * @param priceHT Price HT in cents
 * @param tvaRate TVA rate as string ('20', '10', '5.5')
 * @returns Price TTC in cents
 */
export function calculateTTC(priceHT: number, tvaRate: string = '20'): number {
  const rate = parseFloat(tvaRate) / 100
  return Math.round(priceHT * (1 + rate))
}
