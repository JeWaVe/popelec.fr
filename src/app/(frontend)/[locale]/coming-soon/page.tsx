import { setRequestLocale } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import { parseLocale } from '@/types/enums/locale'
import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  return {
    title: locale === 'fr' ? 'Bientôt disponible | popelec.fr' : 'Coming Soon | popelec.fr',
    robots: { index: false, follow: false },
  }
}

function ComingSoonContent() {
  const t = useTranslations('comingSoon')

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl font-bold text-blue-700 mb-4">popelec.fr</h1>
      <h2 className="text-3xl font-semibold text-neutral-800 mb-6">{t('title')}</h2>
      <p className="max-w-md text-lg text-neutral-600 mb-8">{t('message')}</p>
      <a
        href="mailto:contact@popelec.fr"
        className="inline-block rounded-lg bg-orange-500 px-6 py-3 text-white font-medium hover:bg-orange-600 transition-colors"
      >
        {t('contact')} — contact@popelec.fr
      </a>
    </div>
  )
}

export default async function ComingSoonPage({ params }: Props) {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  setRequestLocale(locale)

  return <ComingSoonContent />
}
