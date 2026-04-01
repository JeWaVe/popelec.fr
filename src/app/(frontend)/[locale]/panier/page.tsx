'use client'

import { useTranslations } from 'next-intl'
import { useCart } from '@/components/cart/CartProvider'
import { formatPrice } from '@/lib/formatPrice'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'

export default function CartPage() {
  const t = useTranslations('cart')
  const tCommon = useTranslations('common')
  const { items, removeItem, updateQuantity, subtotalHT, itemCount } = useCart()
  const locale = useLocale()

  const tva = Math.round(subtotalHT * 0.2) // Simplified: 20% TVA
  const totalTTC = subtotalHT + tva

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <svg className="w-16 h-16 text-neutral-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <h1 className="text-2xl font-bold mb-2">{t('empty')}</h1>
        <p className="text-neutral-500 mb-8">{t('emptyDesc')}</p>
        <Link
          href="/produits"
          className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
        >
          {tCommon('viewProducts')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
      <p className="text-neutral-500 mb-8">{t('item', { count: itemCount })}</p>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            return (
              <div
                key={item.productId}
                className="flex gap-4 p-4 bg-white border border-neutral-200 rounded-lg"
              >
                <div className="w-20 h-20 bg-neutral-100 rounded-lg overflow-hidden relative flex-shrink-0">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill className="object-contain p-2" sizes="80px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <a href={`/${locale}/produits/${item.slug}`} className="font-medium text-neutral-900 hover:text-primary-500 line-clamp-1">
                    {item.name}
                  </a>
                  <p className="text-xs text-neutral-400">{item.sku}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-neutral-300 rounded">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="px-2 py-1 text-sm text-neutral-600 hover:text-primary-500"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-sm border-x border-neutral-300">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="px-2 py-1 text-sm text-neutral-600 hover:text-primary-500"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-neutral-900">
                        {formatPrice(item.priceHT * item.quantity, locale)} {tCommon('priceHT')}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-neutral-400 hover:text-red-500 transition-colors self-start"
                  title={t('remove')}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 h-fit lg:sticky lg:top-24">
          <h2 className="font-bold text-lg mb-4">{tCommon('subtotal')}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">{t('subtotalHT')}</span>
              <span className="font-medium">{formatPrice(subtotalHT, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">{t('tva')}</span>
              <span className="font-medium">{formatPrice(tva, locale)}</span>
            </div>
            <div className="border-t border-neutral-200 pt-2 flex justify-between">
              <span className="font-bold">{t('totalTTC')}</span>
              <span className="font-bold text-lg">{formatPrice(totalTTC, locale)}</span>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/commande"
              className="block w-full bg-accent-500 hover:bg-accent-600 text-white text-center py-3 rounded-lg font-semibold transition-colors"
            >
              {t('checkoutCta')}
            </Link>
            <Link
              href="/devis"
              className="block w-full border border-primary-500 text-primary-500 hover:bg-primary-50 text-center py-3 rounded-lg font-semibold transition-colors"
            >
              {t('quoteCta')}
            </Link>
          </div>

          <Link href="/produits" className="block text-center text-sm text-primary-500 hover:underline mt-4">
            {tCommon('continueShopping')}
          </Link>
        </div>
      </div>
    </div>
  )
}
