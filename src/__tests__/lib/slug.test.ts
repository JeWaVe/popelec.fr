import { describe, it, expect } from 'vitest'
import { slugify } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases an ASCII string', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips French accents (NFD)', () => {
    expect(slugify('café')).toBe('cafe')
    expect(slugify('Démarreurs progressifs')).toBe('demarreurs-progressifs')
    expect(slugify('Électricité Populaire')).toBe('electricite-populaire')
  })

  it('handles cedilla and ligatures', () => {
    expect(slugify('façade')).toBe('facade')
    expect(slugify('garçon')).toBe('garcon')
  })

  it('collapses runs of separators into a single dash', () => {
    expect(slugify('foo   bar___baz')).toBe('foo-bar-baz')
    expect(slugify('a / b / c')).toBe('a-b-c')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('---hello---')).toBe('hello')
    expect(slugify('  spaced  ')).toBe('spaced')
  })

  it('handles digits', () => {
    expect(slugify('Variateur 2.2 kW')).toBe('variateur-2-2-kw')
    expect(slugify('MC9001-2S0007G')).toBe('mc9001-2s0007g')
  })

  it('returns empty string for input that is only separators', () => {
    expect(slugify('---')).toBe('')
    expect(slugify('   ')).toBe('')
  })

  it('handles empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('strips emoji and other non-Latin characters', () => {
    expect(slugify('Hello 🚀 World')).toBe('hello-world')
  })

  it('preserves all-numeric input', () => {
    expect(slugify('12345')).toBe('12345')
  })
})
