import { describe, it, expect } from 'vitest'
import { enumToPayloadOptions } from '@/types/payload-options'

describe('enumToPayloadOptions', () => {
  it('converts a label record to Payload options', () => {
    const labels = {
      draft: 'Brouillon',
      published: 'Publié',
    } as const

    const result = enumToPayloadOptions(labels)
    expect(result).toEqual([
      { label: 'Brouillon', value: 'draft' },
      { label: 'Publié', value: 'published' },
    ])
  })

  it('preserves order of entries', () => {
    const labels = {
      a: 'Alpha',
      b: 'Beta',
      c: 'Charlie',
    } as const

    const result = enumToPayloadOptions(labels)
    expect(result.map((o) => o.value)).toEqual(['a', 'b', 'c'])
  })

  it('handles single entry', () => {
    const result = enumToPayloadOptions({ only: 'Seul' })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ label: 'Seul', value: 'only' })
  })
})
