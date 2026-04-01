/**
 * Reusable validation functions for Payload field validators and client-side use.
 * Each returns `true` if valid, or a string error message if invalid.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+]?[\d\s()./-]{7,20}$/
const SIRET_RE = /^\d{14}$/
const POSTAL_CODE_FR_RE = /^\d{5}$/
const VAT_RE = /^[A-Z]{2}\d{2,13}$/

export function validateEmail(value: unknown): true | string {
  if (typeof value !== 'string' || !EMAIL_RE.test(value)) {
    return 'Adresse email invalide'
  }
  return true
}

export function validatePhone(value: unknown): true | string {
  if (typeof value !== 'string' || !PHONE_RE.test(value.replace(/\s/g, ''))) {
    return 'Numéro de téléphone invalide'
  }
  return true
}

export function validateSiret(value: unknown): true | string {
  if (!value) return true // optional field
  if (typeof value !== 'string' || !SIRET_RE.test(value.replace(/\s/g, ''))) {
    return 'Le SIRET doit contenir 14 chiffres'
  }
  return true
}

export function validatePostalCodeFR(value: unknown): true | string {
  if (typeof value !== 'string' || !POSTAL_CODE_FR_RE.test(value)) {
    return 'Code postal invalide (5 chiffres)'
  }
  return true
}

export function validateVATNumber(value: unknown): true | string {
  if (!value) return true // optional field
  if (typeof value !== 'string' || !VAT_RE.test(value.replace(/\s/g, ''))) {
    return 'Numéro de TVA invalide'
  }
  return true
}

export function validateMinLength(min: number) {
  return (value: unknown): true | string => {
    if (typeof value !== 'string' || value.trim().length < min) {
      return `Minimum ${min} caractères`
    }
    return true
  }
}

export function validatePositiveInteger(value: unknown): true | string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return 'Doit être un nombre entier positif'
  }
  return true
}
