'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useState, type FormEvent } from 'react'

export default function ForgotPasswordPage() {
  const t = useTranslations('auth')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    try {
      await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Silently handle — don't reveal whether email exists
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('resetTitle')}</h1>
        <p className="text-neutral-500 mb-8">{t('resetSuccess')}</p>
        <Link
          href="/compte/connexion"
          className="text-primary-500 hover:underline font-medium"
        >
          {t('loginCta')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold mb-2 text-center">{t('resetTitle')}</h1>
      <p className="text-neutral-500 text-center mb-6">{t('resetDescription')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-neutral-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white py-3 rounded-lg font-semibold transition-colors"
        >
          {loading ? '...' : t('resetCta')}
        </button>
      </form>

      <p className="text-center text-sm text-neutral-500 mt-6">
        <Link href="/compte/connexion" className="text-primary-500 hover:underline font-medium">
          {t('loginCta')}
        </Link>
      </p>
    </div>
  )
}
