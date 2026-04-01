import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function ConfirmationPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const _searchParams = await searchParams
  const t = await getTranslations({ locale, namespace: 'confirmation' })

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
      <p className="text-lg text-neutral-600 mb-8">{t('thankYou')}</p>

      <Link
        href="/produits"
        className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
      >
        {t('backToShop')}
      </Link>
    </div>
  )
}
