'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'

const COOKIE_KEY = 'popelec-cookie-consent'

export function CookieBanner() {
  const t = useTranslations('cookie')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY)
    if (!consent) setVisible(true)
  }, [])

  const handleConsent = (accepted: boolean) => {
    localStorage.setItem(COOKIE_KEY, accepted ? 'accepted' : 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 shadow-lg z-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-neutral-600">{t('message')}</p>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => handleConsent(false)}
            className="px-4 py-2 text-sm border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            {t('decline')}
          </button>
          <button
            onClick={() => handleConsent(true)}
            className="px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
