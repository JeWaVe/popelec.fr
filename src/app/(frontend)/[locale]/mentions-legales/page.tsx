import { setRequestLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { parseLocale, Locales } from '@/types/enums/locale'
import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  return {
    title: locale === Locales.Fr ? 'Mentions légales | popelec.fr' : 'Legal notice | popelec.fr',
  }
}

export default async function LegalNoticePage({ params }: Props) {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  setRequestLocale(locale)

  // Try to load from CMS, fallback to static
  let content = null
  try {
    const payload = await getPayload()
    const result = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'mentions-legales' } },
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
        {locale === Locales.Fr ? 'Mentions légales' : 'Legal notice'}
      </h1>
      <div className="prose prose-neutral max-w-none">
        {content ? (
          <div>Contenu chargé depuis le CMS</div>
        ) : (
          <div>
            <h2>{locale === Locales.Fr ? 'Éditeur du site' : 'Site editor'}</h2>
            <p>
              <strong>Électricité Populaire d&apos;Aucamville</strong><br />
              Aucamville, France<br />
              Email : contact@popelec.fr
            </p>

            <h2>{locale === Locales.Fr ? 'Hébergement' : 'Hosting'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'Le site est hébergé par [à compléter avec les informations de l\'hébergeur].'
                : 'The site is hosted by [to be completed with hosting provider information].'}
            </p>

            <h2>{locale === Locales.Fr ? 'Propriété intellectuelle' : 'Intellectual property'}</h2>
            <p>
              {locale === Locales.Fr
                ? 'L\'ensemble des contenus (textes, images, vidéos) présents sur le site popelec.fr sont protégés par le droit d\'auteur. Toute reproduction est interdite sans autorisation préalable.'
                : 'All content (text, images, videos) on the popelec.fr website is protected by copyright. Any reproduction is prohibited without prior authorization.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
