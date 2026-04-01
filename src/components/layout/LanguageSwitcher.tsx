'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { Locales, type Locale } from '@/types/enums/locale'

export function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()

  const switchLocale = () => {
    const newLocale = locale === Locales.Fr ? Locales.En : Locales.Fr
    // usePathname returns a typed pathname but dynamic routes widen to string
    router.replace(pathname as Parameters<typeof router.replace>[0], { locale: newLocale })
  }

  return (
    <button
      onClick={switchLocale}
      className="text-sm font-medium hover:underline transition-colors"
    >
      {locale === Locales.Fr ? 'EN' : 'FR'}
    </button>
  )
}
