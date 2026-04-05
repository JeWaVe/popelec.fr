import { describe, it, expect } from 'vitest'

// Test the quantity validation logic used in create-checkout-session
function isValidQuantity(quantity: unknown): boolean {
  return (
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 999
  )
}

describe('Checkout quantity validation', () => {
  it('accepts quantity of 1', () => {
    expect(isValidQuantity(1)).toBe(true)
  })

  it('accepts quantity of 999', () => {
    expect(isValidQuantity(999)).toBe(true)
  })

  it('accepts normal quantity', () => {
    expect(isValidQuantity(5)).toBe(true)
  })

  it('rejects zero', () => {
    expect(isValidQuantity(0)).toBe(false)
  })

  it('rejects negative numbers', () => {
    expect(isValidQuantity(-1)).toBe(false)
    expect(isValidQuantity(-100)).toBe(false)
  })

  it('rejects fractional numbers', () => {
    expect(isValidQuantity(1.5)).toBe(false)
    expect(isValidQuantity(0.1)).toBe(false)
  })

  it('rejects numbers above 999', () => {
    expect(isValidQuantity(1000)).toBe(false)
    expect(isValidQuantity(1000000)).toBe(false)
  })

  it('rejects NaN', () => {
    expect(isValidQuantity(NaN)).toBe(false)
  })

  it('rejects Infinity', () => {
    expect(isValidQuantity(Infinity)).toBe(false)
    expect(isValidQuantity(-Infinity)).toBe(false)
  })

  it('rejects strings', () => {
    expect(isValidQuantity('5')).toBe(false)
  })

  it('rejects null/undefined', () => {
    expect(isValidQuantity(null)).toBe(false)
    expect(isValidQuantity(undefined)).toBe(false)
  })
})
