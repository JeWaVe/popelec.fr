import { describe, it, expect } from 'vitest'
import { cartItemsFromJSON } from '@/types/converters'

describe('cartItemsFromJSON', () => {
  it('converts valid cart items', () => {
    const raw = [
      {
        productId: '42',
        name: 'Moteur 1.5kW',
        slug: 'moteur-1-5kw',
        sku: 'MOT-001',
        priceHT: 18500,
        tvaRate: '20',
        quantity: 2,
        image: '/media/moteur.jpg',
      },
    ]

    const result = cartItemsFromJSON(raw)
    expect(result).toHaveLength(1)
    expect(result[0].productId).toBe('42')
    expect(result[0].name).toBe('Moteur 1.5kW')
    expect(result[0].slug).toBe('moteur-1-5kw')
    expect(result[0].sku).toBe('MOT-001')
    expect(result[0].priceHT).toBe(18500)
    expect(result[0].tvaRate).toBe('20')
    expect(result[0].quantity).toBe(2)
    expect(result[0].image).toBe('/media/moteur.jpg')
  })

  it('handles missing optional image', () => {
    const raw = [
      {
        productId: '1',
        name: 'Test',
        slug: 'test',
        sku: 'TST',
        priceHT: 100,
        tvaRate: '20',
        quantity: 1,
      },
    ]

    const result = cartItemsFromJSON(raw)
    expect(result[0].image).toBeUndefined()
  })

  it('defaults missing fields', () => {
    const raw = [{}]
    const result = cartItemsFromJSON(raw)
    expect(result).toHaveLength(1)
    expect(result[0].productId).toBe('')
    expect(result[0].name).toBe('')
    expect(result[0].priceHT).toBe(0)
    expect(result[0].quantity).toBe(1)
  })

  it('defaults invalid tvaRate to 20', () => {
    const raw = [{ tvaRate: '99' }]
    const result = cartItemsFromJSON(raw)
    expect(result[0].tvaRate).toBe('20')
  })

  it('accepts valid tvaRate values', () => {
    expect(cartItemsFromJSON([{ tvaRate: '10' }])[0].tvaRate).toBe('10')
    expect(cartItemsFromJSON([{ tvaRate: '5.5' }])[0].tvaRate).toBe('5.5')
    expect(cartItemsFromJSON([{ tvaRate: '20' }])[0].tvaRate).toBe('20')
  })

  it('returns empty array for non-array input', () => {
    expect(cartItemsFromJSON(null)).toEqual([])
    expect(cartItemsFromJSON(undefined)).toEqual([])
    expect(cartItemsFromJSON('string')).toEqual([])
    expect(cartItemsFromJSON(42)).toEqual([])
    expect(cartItemsFromJSON({})).toEqual([])
  })

  it('returns empty array for empty array', () => {
    expect(cartItemsFromJSON([])).toEqual([])
  })

  it('converts multiple items', () => {
    const raw = [
      { productId: '1', name: 'A', quantity: 1 },
      { productId: '2', name: 'B', quantity: 3 },
    ]
    const result = cartItemsFromJSON(raw)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('A')
    expect(result[1].name).toBe('B')
    expect(result[1].quantity).toBe(3)
  })
})
