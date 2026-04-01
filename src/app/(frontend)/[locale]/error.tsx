'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('error')

  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-neutral-500 mb-8">{t('description')}</p>
      {error.digest && (
        <p className="text-xs text-neutral-400 mb-4 font-mono">Code: {error.digest}</p>
      )}
      <div className="flex gap-4 justify-center">
        <button
          onClick={reset}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {t('retry')}
        </button>
        <Link
          href="/"
          className="border border-neutral-300 hover:border-primary-300 text-neutral-700 px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {t('backHome')}
        </Link>
      </div>
    </div>
  )
}
