'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Link } from '@/i18n/navigation'

export default function QuotePage() {
  const t = useTranslations('quote')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([{ productDescription: '', quantity: 1 }])

  const addItem = () => {
    setItems([...items, { productDescription: '', quantity: 1 }])
  }

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items]
    ;(newItems[index] as any)[field] = value
    setItems(newItems)
  }

  const removeItemRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)

    try {
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: formData.get('contactName'),
          company: formData.get('company'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          siret: formData.get('siret'),
          items: items.map((item) => ({
            productDescription: item.productDescription,
            quantity: item.quantity,
          })),
          message: formData.get('message'),
        }),
      })

      if (response.ok) {
        setSubmitted(true)
      }
    } catch {
      // handle error
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('success')}</h1>
        <p className="text-neutral-500 mb-8">{t('successDesc')}</p>
        <Link href="/produits" className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block">
          {useTranslations('common')('viewProducts')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
      <p className="text-neutral-500 mb-8">{t('subtitle')}</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Contact info */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">{t('contactName')} *</label>
            <input name="contactName" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">{t('company')}</label>
            <input name="company" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">{t('email')} *</label>
            <input name="email" type="email" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">{t('phone')} *</label>
            <input name="phone" type="tel" required className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">{t('siret')}</label>
            <input name="siret" className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
        </div>

        {/* Product items */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Produits</h2>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1">
                  <input
                    value={item.productDescription}
                    onChange={(e) => updateItem(i, 'productDescription', e.target.value)}
                    placeholder={t('productFreeform')}
                    className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    required
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(i)}
                    className="text-neutral-400 hover:text-red-500 mt-2.5"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 text-sm text-primary-500 hover:underline"
          >
            + {t('addProduct')}
          </button>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">{t('message')}</label>
          <textarea
            name="message"
            rows={4}
            className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y"
          />
        </div>

        {/* RGPD consent */}
        <div className="flex items-start gap-3">
          <input type="checkbox" required className="mt-1 w-4 h-4 text-primary-500 border-neutral-300 rounded focus:ring-primary-500" />
          <label className="text-sm text-neutral-600">{t('consent')}</label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '...' : t('submit')}
        </button>
      </form>
    </div>
  )
}
