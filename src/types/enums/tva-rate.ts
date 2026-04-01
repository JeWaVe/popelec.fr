export const TVARates = {
  Standard: '20',
  Intermediate: '10',
  Reduced: '5.5',
} as const

export type TVARate = (typeof TVARates)[keyof typeof TVARates]

export const TVA_RATE_VALUES = Object.values(TVARates) as unknown as readonly TVARate[]

/** Convert a TVA rate string to its decimal multiplier (e.g. '20' → 0.20). */
export function tvaRateToMultiplier(rate: TVARate): number {
  return parseFloat(rate) / 100
}
