import { setRequestLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { parseLocale, Locales } from '@/types/enums/locale'
import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  return {
    title: locale === Locales.Fr ? 'Conditions Générales de Vente | popelec.fr' : 'Terms & Conditions | popelec.fr',
  }
}

export default async function CGVPage({ params }: Props) {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  setRequestLocale(locale)

  let content = null
  try {
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'cgv' } },
      locale,
      limit: 1,
    })
    content = result.docs[0]
  } catch {
    // CMS not available
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">
        {locale === Locales.Fr ? 'Conditions Générales de Vente' : 'Terms & Conditions'}
      </h1>
      <div className="prose prose-neutral max-w-none">
        {content ? (
          <div>Contenu chargé depuis le CMS</div>
        ) : (
          <div>
            <h2>{locale === Locales.Fr ? 'Article 1 - Objet' : 'Article 1 - Purpose'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Les présentes Conditions Générales de Vente régissent les ventes de produits effectuées sur le site popelec.fr, exploité par Électricité Populaire d\'Aucamville.'
                : 'These Terms and Conditions govern the sale of products made on the popelec.fr website, operated by Électricité Populaire d\'Aucamville.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Article 2 - Prix' : 'Article 2 - Prices'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Les prix sont indiqués en euros hors taxes (HT) et toutes taxes comprises (TTC). La TVA applicable est de 20%.'
                : 'Prices are shown in euros excluding VAT (HT) and including VAT (TTC). The applicable VAT rate is 20%.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Article 3 - Commande' : 'Article 3 - Orders'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Toute commande implique l\'acceptation des présentes CGV. La commande est confirmée après paiement intégral.'
                : 'Any order implies acceptance of these Terms. The order is confirmed after full payment.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Article 4 - Droit de rétractation' : 'Article 4 - Right of withdrawal'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Conformément à l\'article L221-18 du Code de la consommation, le consommateur dispose d\'un délai de 14 jours pour exercer son droit de rétractation. Ce droit ne s\'applique pas aux professionnels.'
                : 'In accordance with Article L221-18 of the Consumer Code, the consumer has 14 days to exercise their right of withdrawal. This right does not apply to professionals.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Article 5 - Livraison' : 'Article 5 - Delivery'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Les délais de livraison sont donnés à titre indicatif. Les produits sont livrés à l\'adresse indiquée lors de la commande.'
                : 'Delivery times are given as an indication. Products are delivered to the address provided during the order.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Article 6 - Garanties' : 'Article 6 - Warranties'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Tous les produits bénéficient de la garantie légale de conformité (2 ans) et de la garantie des vices cachés.'
                : 'All products benefit from the legal guarantee of conformity (2 years) and the guarantee against hidden defects.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
