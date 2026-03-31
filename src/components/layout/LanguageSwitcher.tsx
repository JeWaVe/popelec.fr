'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'

export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const switchLocale = () => {
    const newLocale = locale === 'fr' ? 'en' : 'fr'
    router.replace(pathname as any, { locale: newLocale })
  }

  return (
    <button
      onClick={switchLocale}
      className="text-sm font-medium hover:underline transition-colors"
    >
      {locale === 'fr' ? 'EN' : 'FR'}
    </button>
  )
}
