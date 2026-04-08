import { describe, it, expect } from 'vitest'
import {
  parseExtractedPayload,
  ExtractedPayloadValidationError,
  type ExtractedCandidate,
} from '@/lib/import/llmSchema'
import { StubLlmExtractor } from '@/lib/import/llmExtractor'
import type { ScannedTree } from '@/lib/import/seafileScanner'

const MINIMAL_VALID_RAW = {
  candidates: [
    {
      proposedSku: 'MC9001-2S0007G',
      proposedName: { fr: 'Variateur 0.75 kW', en: 'Inverter 0.75 kW' },
      proposedShortDescription: { fr: 'Court FR', en: 'Short EN' },
      proposedCategorySlug: 'variateurs',
      proposedBrand: 'NUOMAKE',
      proposedSourceCurrency: 'USD',
      proposedSourceAmount: 73,
      proposedSpecs: [
        {
          label: { fr: 'Puissance', en: 'Power' },
          value: { fr: '0.75', en: '0.75' },
          unit: 'kW',
          group: 'Électrique',
        },
      ],
      proposedImagePaths: [{ path: '/inverters/0.75kw.png' }],
      proposedDatasheetPaths: [{ path: '/inverters/0.75kw.pdf' }],
    },
  ],
}

describe('parseExtractedPayload — happy path', () => {
  it('parses a fully populated candidate', () => {
    const result = parseExtractedPayload(MINIMAL_VALID_RAW)
    expect(result.candidates).toHaveLength(1)
    const c = result.candidates[0]
    expect(c.proposedSku).toBe('MC9001-2S0007G')
    expect(c.proposedName.fr).toBe('Variateur 0.75 kW')
    expect(c.proposedName.en).toBe('Inverter 0.75 kW')
    expect(c.proposedCategorySlug).toBe('variateurs')
    expect(c.proposedSourceCurrency).toBe('USD')
    expect(c.proposedSourceAmount).toBe(73)
    expect(c.proposedSpecs).toHaveLength(1)
    expect(c.proposedImagePaths).toHaveLength(1)
    expect(c.proposedDatasheetPaths).toHaveLength(1)
  })

  it('lowercases the category slug', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedCategorySlug: 'VARIATEURS',
        },
      ],
    }
    const result = parseExtractedPayload(raw)
    expect(result.candidates[0].proposedCategorySlug).toBe('variateurs')
  })

  it('uppercases the source currency', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedSourceCurrency: 'usd',
        },
      ],
    }
    const result = parseExtractedPayload(raw)
    expect(result.candidates[0].proposedSourceCurrency).toBe('USD')
  })

  it('accepts a candidate without specs and without datasheets', () => {
    const raw = {
      candidates: [
        {
          proposedSku: 'X-1',
          proposedName: { fr: 'n', en: 'n' },
          proposedShortDescription: { fr: 'd', en: 'd' },
          proposedCategorySlug: 'moteurs',
          proposedSourceCurrency: 'EUR',
          proposedSourceAmount: 10,
          proposedImagePaths: [{ path: '/img.png' }],
        },
      ],
    }
    const result = parseExtractedPayload(raw)
    expect(result.candidates[0].proposedSpecs).toEqual([])
    expect(result.candidates[0].proposedDatasheetPaths).toEqual([])
    expect(result.candidates[0].proposedBrand).toBeUndefined()
  })

  it('parses an empty candidates array', () => {
    const result = parseExtractedPayload({ candidates: [] })
    expect(result.candidates).toEqual([])
  })

  it('parses image alt as a localized string', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedImagePaths: [
            {
              path: '/img.png',
              alt: { fr: 'Vue avant', en: 'Front view' },
            },
          ],
        },
      ],
    }
    const result = parseExtractedPayload(raw)
    expect(result.candidates[0].proposedImagePaths[0].alt).toEqual({
      fr: 'Vue avant',
      en: 'Front view',
    })
  })
})

describe('parseExtractedPayload — validation errors', () => {
  function expectIssue(raw: unknown, substring: string): void {
    let caught: ExtractedPayloadValidationError | null = null
    try {
      parseExtractedPayload(raw)
    } catch (err) {
      if (err instanceof ExtractedPayloadValidationError) caught = err
      else throw err
    }
    if (caught === null) {
      throw new Error('expected ExtractedPayloadValidationError to be thrown')
    }
    expect(caught.issues.some((i) => i.includes(substring))).toBe(true)
  }

  it('rejects a non-object root', () => {
    expect(() => parseExtractedPayload(null)).toThrow(ExtractedPayloadValidationError)
    expect(() => parseExtractedPayload('foo')).toThrow(ExtractedPayloadValidationError)
    expect(() => parseExtractedPayload([])).toThrow(ExtractedPayloadValidationError)
  })

  it('rejects a missing candidates array', () => {
    expect(() => parseExtractedPayload({})).toThrow(ExtractedPayloadValidationError)
  })

  it('rejects an empty SKU', () => {
    const raw = {
      candidates: [{ ...MINIMAL_VALID_RAW.candidates[0], proposedSku: '' }],
    }
    expectIssue(raw, 'proposedSku')
  })

  it('rejects a name with only fr', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedName: { fr: 'only fr' },
        },
      ],
    }
    expectIssue(raw, 'proposedName.en')
  })

  it('rejects an unknown currency', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedSourceCurrency: 'GBP',
        },
      ],
    }
    expectIssue(raw, 'proposedSourceCurrency')
  })

  it('rejects a negative amount', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedSourceAmount: -1,
        },
      ],
    }
    expectIssue(raw, 'proposedSourceAmount')
  })

  it('rejects a zero amount', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedSourceAmount: 0,
        },
      ],
    }
    expectIssue(raw, 'proposedSourceAmount')
  })

  it('rejects a non-number amount', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedSourceAmount: '73',
        },
      ],
    }
    expectIssue(raw, 'proposedSourceAmount')
  })

  it('rejects an empty image array', () => {
    const raw = {
      candidates: [{ ...MINIMAL_VALID_RAW.candidates[0], proposedImagePaths: [] }],
    }
    expectIssue(raw, 'proposedImagePaths')
  })

  it('rejects an image entry without a path', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedImagePaths: [{ alt: { fr: 'a', en: 'a' } }],
        },
      ],
    }
    expectIssue(raw, 'proposedImagePaths[0].path')
  })

  it('rejects a missing category slug', () => {
    const raw = {
      candidates: [{ ...MINIMAL_VALID_RAW.candidates[0], proposedCategorySlug: '' }],
    }
    expectIssue(raw, 'proposedCategorySlug')
  })

  it('rejects a spec with a missing value', () => {
    const raw = {
      candidates: [
        {
          ...MINIMAL_VALID_RAW.candidates[0],
          proposedSpecs: [{ label: { fr: 'Power', en: 'Power' } }],
        },
      ],
    }
    expectIssue(raw, 'proposedSpecs[0].value')
  })

  it('aggregates multiple issues from a single candidate', () => {
    const raw = {
      candidates: [
        {
          proposedSku: '',
          proposedName: { fr: '', en: '' },
          proposedShortDescription: 'not an object',
          proposedCategorySlug: '',
          proposedSourceCurrency: 'XYZ',
          proposedSourceAmount: -10,
          proposedImagePaths: [],
        },
      ],
    }
    let caught: ExtractedPayloadValidationError | null = null
    try {
      parseExtractedPayload(raw)
    } catch (err) {
      if (err instanceof ExtractedPayloadValidationError) caught = err
    }
    if (caught === null) throw new Error('expected validation error')
    expect(caught.issues.length).toBeGreaterThanOrEqual(5)
  })
})

describe('StubLlmExtractor', () => {
  const fakeTree: ScannedTree = {
    libraryId: 'lib-1',
    rootPath: '/',
    files: [],
    directories: ['/'],
    truncated: false,
  }

  const canned: ExtractedCandidate[] = [
    {
      proposedSku: 'STUB-1',
      proposedName: { fr: 'n', en: 'n' },
      proposedShortDescription: { fr: 'd', en: 'd' },
      proposedCategorySlug: 'variateurs',
      proposedSourceCurrency: 'USD',
      proposedSourceAmount: 50,
      proposedSpecs: [],
      proposedImagePaths: [{ path: '/img.png' }],
      proposedDatasheetPaths: [],
    },
  ]

  it('returns its canned data verbatim', async () => {
    const stub = new StubLlmExtractor(canned)
    const result = await stub.extract({ tree: fakeTree, libraryName: 'L' })
    expect(result).toEqual(canned)
  })

  it('describes itself with the candidate count', () => {
    const stub = new StubLlmExtractor(canned)
    expect(stub.describe()).toBe('stub(1 candidates)')
  })

  it('returns an empty list when constructed with no candidates', async () => {
    const stub = new StubLlmExtractor([])
    const result = await stub.extract({ tree: fakeTree, libraryName: 'L' })
    expect(result).toEqual([])
  })
})
