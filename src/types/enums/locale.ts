export const Locales = {
  Fr: 'fr',
  En: 'en',
} as const

export type Locale = (typeof Locales)[keyof typeof Locales]

export const LOCALE_VALUES = [Locales.Fr, Locales.En] as const satisfies readonly Locale[]

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALE_VALUES as readonly string[]).includes(value)
}

export function parseLocale(raw: string): Locale {
  if (isLocale(raw)) return raw
  return Locales.Fr
}
