import { describe, it, expect } from 'vitest'
import { Locales, LOCALE_VALUES, isLocale, parseLocale } from '@/types/enums/locale'

describe('Locales', () => {
  it('has Fr and En values', () => {
    expect(Locales.Fr).toBe('fr')
    expect(Locales.En).toBe('en')
  })
})

describe('LOCALE_VALUES', () => {
  it('contains both locales', () => {
    expect(LOCALE_VALUES).toContain('fr')
    expect(LOCALE_VALUES).toContain('en')
    expect(LOCALE_VALUES).toHaveLength(2)
  })
})

describe('isLocale', () => {
  it('returns true for valid locales', () => {
    expect(isLocale('fr')).toBe(true)
    expect(isLocale('en')).toBe(true)
  })

  it('returns false for invalid values', () => {
    expect(isLocale('de')).toBe(false)
    expect(isLocale('FR')).toBe(false)
    expect(isLocale('')).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(undefined)).toBe(false)
    expect(isLocale(42)).toBe(false)
  })
})

describe('parseLocale', () => {
  it('returns the locale if valid', () => {
    expect(parseLocale('fr')).toBe('fr')
    expect(parseLocale('en')).toBe('en')
  })

  it('falls back to fr for invalid input', () => {
    expect(parseLocale('de')).toBe('fr')
    expect(parseLocale('')).toBe('fr')
    expect(parseLocale('xyz')).toBe('fr')
  })
})
