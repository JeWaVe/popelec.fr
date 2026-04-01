import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function NotFoundPage() {
  const t = await getTranslations('notFound')

  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <p className="text-6xl font-bold text-primary-500 mb-4">404</p>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-neutral-500 mb-8">{t('description')}</p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/"
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {t('backHome')}
        </Link>
        <Link
          href="/produits"
          className="border border-neutral-300 hover:border-primary-300 text-neutral-700 px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {t('browseCatalog')}
        </Link>
      </div>
    </div>
  )
}
