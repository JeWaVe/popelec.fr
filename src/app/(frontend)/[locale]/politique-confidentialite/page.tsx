import { setRequestLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { parseLocale, Locales } from '@/types/enums/locale'
import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  return {
    title: locale === Locales.Fr ? 'Politique de confidentialité | popelec.fr' : 'Privacy policy | popelec.fr',
  }
}

export default async function PrivacyPage({ params }: Props) {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  setRequestLocale(locale)

  let content = null
  try {
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'politique-confidentialite' } },
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
        {locale === Locales.Fr ? 'Politique de confidentialité' : 'Privacy policy'}
      </h1>
      <div className="prose prose-neutral max-w-none">
        {content ? (
          <div>Contenu chargé depuis le CMS</div>
        ) : (
          <div>
            <h2>{locale === Locales.Fr ? 'Responsable du traitement' : 'Data controller'}</h2>
            <p>
              <strong>Électricité Populaire d&apos;Aucamville</strong><br />
              Email : contact@popelec.fr
            </p>

            <h2>{locale === Locales.Fr ? 'Données collectées' : 'Data collected'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Nous collectons les données suivantes : nom, prénom, adresse email, téléphone, adresse postale, données de commande.'
                : 'We collect the following data: name, email address, phone number, postal address, order data.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Finalité du traitement' : 'Purpose of processing'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Vos données sont utilisées pour : traiter vos commandes, gérer votre compte client, répondre à vos demandes de devis, vous envoyer des informations relatives à vos commandes.'
                : 'Your data is used to: process your orders, manage your customer account, respond to your quote requests, send you order-related information.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Base légale' : 'Legal basis'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Le traitement est fondé sur l\'exécution du contrat (commande) et votre consentement (demande de devis).'
                : 'Processing is based on contract execution (orders) and your consent (quote requests).'}
            </p>

            <h2>{locale === Locales.Fr ? 'Durée de conservation' : 'Retention period'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Les données sont conservées pendant 3 ans après le dernier achat ou contact, conformément à la réglementation RGPD.'
                : 'Data is retained for 3 years after the last purchase or contact, in compliance with GDPR regulations.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Vos droits' : 'Your rights'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Vous disposez d\'un droit d\'accès, de rectification, de suppression, de portabilité et d\'opposition au traitement de vos données. Pour exercer ces droits, contactez-nous à contact@popelec.fr.'
                : 'You have the right to access, rectify, delete, port and object to the processing of your data. To exercise these rights, contact us at contact@popelec.fr.'}
            </p>

            <h2>{locale === Locales.Fr ? 'Sous-traitants' : 'Third-party processors'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Nous utilisons les services de Stripe pour le traitement des paiements. Stripe agit en tant que sous-traitant conformément au RGPD.'
                : 'We use Stripe for payment processing. Stripe acts as a processor in compliance with GDPR.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
