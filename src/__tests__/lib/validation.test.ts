import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePhone,
  validateSiret,
  validatePostalCodeFR,
  validateVATNumber,
  validateMinLength,
  validatePositiveInteger,
} from '@/lib/validation'

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true)
    expect(validateEmail('user.name+tag@domain.fr')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(validateEmail('')).not.toBe(true)
    expect(validateEmail('notanemail')).not.toBe(true)
    expect(validateEmail('@domain.com')).not.toBe(true)
    expect(validateEmail('user@')).not.toBe(true)
    expect(validateEmail(null)).not.toBe(true)
    expect(validateEmail(42)).not.toBe(true)
  })
})

describe('validatePhone', () => {
  it('accepts valid phone numbers', () => {
    expect(validatePhone('0612345678')).toBe(true)
    expect(validatePhone('+33 6 12 34 56 78')).toBe(true)
    expect(validatePhone('+1 (555) 123-4567')).toBe(true)
    expect(validatePhone('01.23.45.67.89')).toBe(true)
  })

  it('rejects invalid phone numbers', () => {
    expect(validatePhone('')).not.toBe(true)
    expect(validatePhone('123')).not.toBe(true)
    expect(validatePhone('abcdefg')).not.toBe(true)
    expect(validatePhone(null)).not.toBe(true)
  })
})

describe('validateSiret', () => {
  it('accepts valid SIRET', () => {
    expect(validateSiret('12345678901234')).toBe(true)
  })

  it('accepts empty/null (optional)', () => {
    expect(validateSiret('')).toBe(true)
    expect(validateSiret(null)).toBe(true)
    expect(validateSiret(undefined)).toBe(true)
  })

  it('rejects invalid SIRET', () => {
    expect(validateSiret('1234')).not.toBe(true)
    expect(validateSiret('abcdefghijklmn')).not.toBe(true)
    expect(validateSiret('123456789012345')).not.toBe(true) // 15 digits
  })
})

describe('validatePostalCodeFR', () => {
  it('accepts valid French postal codes', () => {
    expect(validatePostalCodeFR('75001')).toBe(true)
    expect(validatePostalCodeFR('31000')).toBe(true)
  })

  it('rejects invalid postal codes', () => {
    expect(validatePostalCodeFR('7500')).not.toBe(true)
    expect(validatePostalCodeFR('750011')).not.toBe(true)
    expect(validatePostalCodeFR('ABCDE')).not.toBe(true)
    expect(validatePostalCodeFR('')).not.toBe(true)
  })
})

describe('validateVATNumber', () => {
  it('accepts valid VAT numbers', () => {
    expect(validateVATNumber('FR12345678901')).toBe(true)
    expect(validateVATNumber('DE123456789')).toBe(true)
  })

  it('accepts empty/null (optional)', () => {
    expect(validateVATNumber('')).toBe(true)
    expect(validateVATNumber(null)).toBe(true)
    expect(validateVATNumber(undefined)).toBe(true)
  })

  it('rejects invalid VAT numbers', () => {
    expect(validateVATNumber('12345')).not.toBe(true)
    expect(validateVATNumber('XYZABC')).not.toBe(true)
  })
})

describe('validateMinLength', () => {
  const validate3 = validateMinLength(3)

  it('accepts strings meeting minimum length', () => {
    expect(validate3('abc')).toBe(true)
    expect(validate3('abcdef')).toBe(true)
  })

  it('rejects strings below minimum length', () => {
    expect(validate3('ab')).not.toBe(true)
    expect(validate3('')).not.toBe(true)
    expect(validate3('  ')).not.toBe(true) // whitespace-only
  })

  it('rejects non-strings', () => {
    expect(validate3(null)).not.toBe(true)
    expect(validate3(42)).not.toBe(true)
  })
})

describe('validatePositiveInteger', () => {
  it('accepts positive integers', () => {
    expect(validatePositiveInteger(1)).toBe(true)
    expect(validatePositiveInteger(100)).toBe(true)
  })

  it('rejects non-positive or non-integer', () => {
    expect(validatePositiveInteger(0)).not.toBe(true)
    expect(validatePositiveInteger(-1)).not.toBe(true)
    expect(validatePositiveInteger(1.5)).not.toBe(true)
    expect(validatePositiveInteger('1')).not.toBe(true)
    expect(validatePositiveInteger(null)).not.toBe(true)
  })
})
