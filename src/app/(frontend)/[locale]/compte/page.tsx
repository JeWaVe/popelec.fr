import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { parseLocale } from '@/types/enums/locale'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function AccountPage({ params }: Props) {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'account' })

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href="/compte/commandes"
          className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
        >
          <svg className="w-8 h-8 text-primary-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="font-semibold text-lg mb-1">{t('orders')}</h2>
          <p className="text-sm text-neutral-500">{t('noOrders')}</p>
        </Link>

        <Link
          href="/compte/devis"
          className="p-6 bg-white border border-neutral-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
        >
          <svg className="w-8 h-8 text-primary-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="font-semibold text-lg mb-1">{t('quotes')}</h2>
          <p className="text-sm text-neutral-500">{t('noQuotes')}</p>
        </Link>
      </div>
    </div>
  )
}
