import { getTranslations, setRequestLocale } from 'next-intl/server'
import { parseLocale } from '@/types/enums/locale'

type Props = { params: Promise<{ locale: string }> }

export default async function OrdersPage({ params }: Props) {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'account' })

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('orders')}</h1>
      <p className="text-neutral-500">{t('noOrders')}</p>
    </div>
  )
}
