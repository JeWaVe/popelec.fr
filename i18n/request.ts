import { getRequestConfig } from 'next-intl/server'
import { isLocale, Locales } from '@/types/enums/locale'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !isLocale(locale)) {
    locale = Locales.Fr
  }
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
