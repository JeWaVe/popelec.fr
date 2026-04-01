export const Countries = {
  FR: 'FR',
  DE: 'DE',
  BE: 'BE',
  CH: 'CH',
  LU: 'LU',
  ES: 'ES',
  IT: 'IT',
  GB: 'GB',
} as const

export type Country = (typeof Countries)[keyof typeof Countries]

export const COUNTRY_VALUES = Object.values(Countries) as unknown as readonly Country[]
