'use client'

import { useTranslations } from 'next-intl'
import { useCart } from '@/components/cart/CartProvider'
import { formatPrice, calculateTTC } from '@/lib/formatPrice'
import { useLocale } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'

export default function CheckoutPage() {
  const t = useTranslations('checkout')
  const tCart = useTranslations('cart')
  const tCommon = useTranslations('common')
  const { items, subtotalHT, itemCount } = useCart()
  const locale = useLocale()
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [loading, setLoading] = useState(false)

  const tva = Math.round(subtotalHT * 0.2)
  const totalTTC = subtotalHT + tva

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">{tCart('empty')}</h1>
        <Link href="/produits" className="bg-primary-500 text-white px-8 py-3 rounded-lg font-semibold inline-block">
          {tCommon('viewProducts')}
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          locale,
        }),
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // handle error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Shipping address */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">{t('shippingAddress')}</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('firstName')} *</label>
                  <input name="shipping.firstName" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('lastName')} *</label>
                  <input name="shipping.lastName" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('company')}</label>
                  <input name="shipping.company" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('address')} *</label>
                  <input name="shipping.address" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('city')} *</label>
                  <input name="shipping.city" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('postalCode')} *</label>
                  <input name="shipping.postalCode" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('phone')} *</label>
                  <input name="shipping.phone" type="tel" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
              </div>
            </div>

            {/* Billing address */}
            <div className="bg-white border border-neutral-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{t('billingAddress')}</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sameAsShipping}
                    onChange={(e) => setSameAsShipping(e.target.checked)}
                    className="w-4 h-4 text-primary-500 border-neutral-300 rounded"
                  />
                  {t('sameAsShipping')}
                </label>
              </div>
              {!sameAsShipping && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('firstName')}</label>
                    <input name="billing.firstName" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('lastName')}</label>
                    <input name="billing.lastName" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('company')}</label>
                    <input name="billing.company" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('vatNumber')}</label>
                    <input name="billing.vatNumber" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('address')}</label>
                    <input name="billing.address" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('city')}</label>
                    <input name="billing.city" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">{t('postalCode')}</label>
                    <input name="billing.postalCode" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 h-fit lg:sticky lg:top-24">
            <h2 className="font-bold text-lg mb-4">{t('orderSummary')}</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span className="text-neutral-600 truncate mr-2">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium whitespace-nowrap">
                    {formatPrice(item.priceHT * item.quantity, locale)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-200 pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>{tCart('subtotalHT')}</span>
                <span>{formatPrice(subtotalHT, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span>{tCart('tva')}</span>
                <span>{formatPrice(tva, locale)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-neutral-200 pt-2">
                <span>{tCart('totalTTC')}</span>
                <span>{formatPrice(totalTTC, locale)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-accent-500 hover:bg-accent-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? '...' : t('payNow')}
            </button>
            <p className="text-xs text-neutral-400 text-center mt-3">
              {t('securePayment')}
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}
