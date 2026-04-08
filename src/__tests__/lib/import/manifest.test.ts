import { describe, it, expect } from 'vitest'
import { loadManifest, ManifestValidationError } from '@/lib/import/manifest'

const VALID_YAML = `
version: 1
supplier:
  name: "Yueqing Nuomake Technology Co., Ltd."
  reference: "nuomake-2026-04"
defaults:
  tvaRate: standard
  trackStock: true
  lowStockThreshold: 5
  initialStock: 10
  status: draft
products:
  - sku: MC9001-2S0007G
    category: variateurs
    brand: NUOMAKE
    name:
      fr: "Variateur de fréquence 0.75 kW"
      en: "Frequency inverter 0.75 kW"
    shortDescription:
      fr: "Description FR"
      en: "Description EN"
    source:
      currency: USD
      amount: 73
      originSku: MC9001-2S007G
    specs:
      - label: { fr: "Puissance", en: "Power" }
        value: { fr: "0.75", en: "0.75" }
        unit: "kW"
        group: "Électrique"
    physical:
      weight: 1.2
    images:
      - path: "documents/inverter 7.5kw.png"
        alt:
          fr: "Variateur"
          en: "Inverter"
    datasheets: []
`

describe('loadManifest — happy path', () => {
  it('parses a valid manifest', () => {
    const m = loadManifest(VALID_YAML)
    expect(m.version).toBe(1)
    expect(m.supplier.reference).toBe('nuomake-2026-04')
    expect(m.products).toHaveLength(1)
    expect(m.products[0].sku).toBe('MC9001-2S0007G')
    expect(m.products[0].category).toBe('variateurs')
    expect(m.products[0].source.amount).toBe(73)
    expect(m.products[0].source.currency).toBe('USD')
    expect(m.products[0].name.fr).toBe('Variateur de fréquence 0.75 kW')
    expect(m.products[0].name.en).toBe('Frequency inverter 0.75 kW')
    expect(m.products[0].images).toHaveLength(1)
    expect(m.products[0].importLocked).toBe(false)
  })

  it('applies defaults when defaults block is missing', () => {
    const yaml = `
version: 1
supplier:
  name: "X"
  reference: "x-1"
products:
  - sku: ABC-123
    category: variateurs
    name: { fr: "n", en: "n" }
    shortDescription: { fr: "d", en: "d" }
    source: { currency: EUR, amount: 10 }
    images:
      - path: "img.png"
`
    const m = loadManifest(yaml)
    expect(m.defaults.tvaRate).toBe('20')
    expect(m.defaults.status).toBe('draft')
    expect(m.defaults.initialStock).toBe(10)
  })

  it('honours importLocked: true', () => {
    const yaml = `
version: 1
supplier: { name: "X", reference: "x-1" }
products:
  - sku: ABC-123
    category: variateurs
    name: { fr: "n", en: "n" }
    shortDescription: { fr: "d", en: "d" }
    source: { currency: EUR, amount: 10 }
    images: [{ path: "img.png" }]
    importLocked: true
`
    const m = loadManifest(yaml)
    expect(m.products[0].importLocked).toBe(true)
  })

  it('accepts CNY currency', () => {
    const yaml = `
version: 1
supplier: { name: "X", reference: "x-1" }
products:
  - sku: ABC-123
    category: moteurs
    name: { fr: "n", en: "n" }
    shortDescription: { fr: "d", en: "d" }
    source: { currency: CNY, amount: 854 }
    images: [{ path: "img.png" }]
`
    const m = loadManifest(yaml)
    expect(m.products[0].source.currency).toBe('CNY')
  })
})

describe('loadManifest — validation errors', () => {
  function expectIssue(yaml: string, issueSubstring: string): void {
    let caught: ManifestValidationError | null = null
    try {
      loadManifest(yaml)
    } catch (err) {
      if (err instanceof ManifestValidationError) caught = err
      else throw err
    }
    if (caught === null) throw new Error('expected ManifestValidationError to be thrown')
    expect(caught.issues.some((i) => i.includes(issueSubstring))).toBe(true)
  }

  it('rejects wrong version', () => {
    expectIssue(VALID_YAML.replace('version: 1', 'version: 2'), 'version')
  })

  it('rejects bad supplier reference', () => {
    expectIssue(
      VALID_YAML.replace('reference: "nuomake-2026-04"', 'reference: "Bad Ref!"'),
      'supplier.reference',
    )
  })

  it('rejects bad SKU', () => {
    expectIssue(VALID_YAML.replace('MC9001-2S0007G', 'A B'), 'sku')
  })

  it('rejects unknown currency', () => {
    expectIssue(VALID_YAML.replace('currency: USD', 'currency: GBP'), 'currency')
  })

  it('rejects negative amount', () => {
    expectIssue(VALID_YAML.replace('amount: 73', 'amount: -1'), 'amount')
  })

  it('rejects zero amount', () => {
    expectIssue(VALID_YAML.replace('amount: 73', 'amount: 0'), 'amount')
  })

  it('rejects missing English name', () => {
    const yaml = `
version: 1
supplier: { name: "X", reference: "x-1" }
products:
  - sku: ABC-123
    category: variateurs
    name: { fr: "only fr" }
    shortDescription: { fr: "d", en: "d" }
    source: { currency: EUR, amount: 10 }
    images: [{ path: "img.png" }]
`
    expectIssue(yaml, 'name.en')
  })

  it('rejects empty images array', () => {
    const yaml = `
version: 1
supplier: { name: "X", reference: "x-1" }
products:
  - sku: ABC-123
    category: variateurs
    name: { fr: "n", en: "n" }
    shortDescription: { fr: "d", en: "d" }
    source: { currency: EUR, amount: 10 }
    images: []
`
    expectIssue(yaml, 'images')
  })

  it('rejects duplicate SKUs', () => {
    const yaml = `
version: 1
supplier: { name: "X", reference: "x-1" }
products:
  - sku: SAME-SKU
    category: variateurs
    name: { fr: "a", en: "a" }
    shortDescription: { fr: "d", en: "d" }
    source: { currency: EUR, amount: 10 }
    images: [{ path: "img.png" }]
  - sku: SAME-SKU
    category: variateurs
    name: { fr: "b", en: "b" }
    shortDescription: { fr: "d", en: "d" }
    source: { currency: EUR, amount: 20 }
    images: [{ path: "img2.png" }]
`
    expectIssue(yaml, 'duplicate SKU')
  })

  it('rejects non-existent products array', () => {
    const yaml = `
version: 1
supplier: { name: "X", reference: "x-1" }
products: []
`
    expectIssue(yaml, 'products')
  })

  it('rejects malformed YAML', () => {
    expect(() => loadManifest(': this is : not yaml :')).toThrow(ManifestValidationError)
  })

  it('aggregates multiple issues', () => {
    const yaml = `
version: 9
supplier: { name: "X", reference: "BAD!" }
products:
  - sku: "x"
    category: "BAD CAT"
    name: {}
    shortDescription: {}
    source: { currency: GBP, amount: -5 }
    images: []
`
    let caught: ManifestValidationError | null = null
    try {
      loadManifest(yaml)
    } catch (err) {
      if (err instanceof ManifestValidationError) caught = err
    }
    if (caught === null) throw new Error('expected ManifestValidationError to be thrown')
    expect(caught.issues.length).toBeGreaterThanOrEqual(5)
  })
})
