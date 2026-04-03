'use client'

import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'

export function SignOutButton() {
  const t = useTranslations('nav')
  const { user, loading, logout } = useAuth()

  if (loading || !user) return null

  return (
    <button
      onClick={logout}
      className="mt-8 px-6 py-2.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg font-medium transition-colors"
    >
      {t('logout')}
    </button>
  )
}
