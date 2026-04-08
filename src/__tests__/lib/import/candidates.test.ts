import { describe, it, expect, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { applyCandidate, type CandidateInput } from '@/lib/import/candidates'
import { StaticFxRateProvider } from '@/lib/import/fxRates'
import { SourceCurrencies } from '@/lib/import/pricing'

/**
 * Minimal in-memory fake of the Payload local API. Supports just enough of
 * `find`, `create`, and `update` for {@link applyCandidate} to run end-to-end
 * without touching a database.
 */
interface FakeRecord {
  id: number
  [key: string]: unknown
}

interface FindArgs {
  collection: string
  where?: Record<string, { equals?: unknown }>
  limit?: number
}

class FakePayload {
  private records: Record<string, FakeRecord[]> = {
    products: [],
    categories: [],
    media: [],
  }
  private nextId = 1
  public createCalls: Array<{ collection: string; data: unknown; locale?: string }> = []
  public updateCalls: Array<{
    collection: string
    id: number
    data: unknown
    locale?: string
  }> = []

  seed(collection: string, record: Omit<FakeRecord, 'id'> & { id?: number }): FakeRecord {
    const id = record.id ?? this.nextId++
    const full = { ...record, id }
    if (!this.records[collection]) this.records[collection] = []
    this.records[collection].push(full)
    if (id >= this.nextId) this.nextId = id + 1
    return full
  }

  async find(args: FindArgs): Promise<{ docs: FakeRecord[]; totalDocs: number }> {
    const { collection, where } = args
    const docs = this.records[collection] ?? []
    if (!where) return { docs: [...docs], totalDocs: docs.length }

    const filtered = docs.filter((doc) => {
      for (const [field, cond] of Object.entries(where)) {
        if (cond?.equals !== undefined && doc[field] !== cond.equals) return false
      }
      return true
    })
    return { docs: filtered, totalDocs: filtered.length }
  }

  async create(args: {
    collection: string
    data: Record<string, unknown>
    locale?: string
    draft?: boolean
  }): Promise<FakeRecord> {
    this.createCalls.push({
      collection: args.collection,
      data: args.data,
      locale: args.locale,
    })
    const record = { ...args.data, id: this.nextId++ }
    if (!this.records[args.collection]) this.records[args.collection] = []
    this.records[args.collection].push(record as FakeRecord)
    return record as FakeRecord
  }

  async update(args: {
    collection: string
    id: number
    data: Record<string, unknown>
    locale?: string
    draft?: boolean
  }): Promise<FakeRecord> {
    this.updateCalls.push({
      collection: args.collection,
      id: args.id,
      data: args.data,
      locale: args.locale,
    })
    const docs = this.records[args.collection] ?? []
    const idx = docs.findIndex((d) => d.id === args.id)
    if (idx === -1) throw new Error(`fake update: no ${args.collection}#${args.id}`)
    const merged = { ...docs[idx], ...args.data }
    docs[idx] = merged
    return merged
  }

  /** Cast helper so we can pass the fake to applyCandidate(). */
  asPayload(): Payload {
    return this as unknown as Payload
  }
}

const SAMPLE_CANDIDATE: CandidateInput = {
  sku: 'MC9001-2S0007G',
  name: { fr: 'Variateur 0.75 kW', en: 'Inverter 0.75 kW' },
  shortDescription: { fr: 'Court FR', en: 'Short EN' },
  categorySlug: 'variateurs',
  brand: 'NUOMAKE',
  sourceCurrency: SourceCurrencies.USD,
  sourceAmount: 73,
  specs: [
    {
      label: { fr: 'Puissance', en: 'Power' },
      value: { fr: '0.75', en: '0.75' },
      unit: 'kW',
      group: 'Électrique',
    },
  ],
  imagePaths: [{ path: '/inverters/0.75kw.png' }],
}

function makeOptions() {
  return {
    libraryId: 'lib-1',
    libraryName: 'Nuomake',
    fxProvider: new StaticFxRateProvider(),
  }
}

describe('applyCandidate', () => {
  let payload: FakePayload

  beforeEach(() => {
    payload = new FakePayload()
    // The category must exist for the lookup to succeed.
    payload.seed('categories', { slug: 'variateurs', name: 'Variateurs' })
    // Pre-seed a media record matching the normalized filename so
    // uploadProductImages takes the "reuse" branch and never calls
    // SeafileFileSource.read().
    payload.seed('media', { filename: 'mc9001-2s0007g-1.png' })
  })

  it('creates a new product when none exists for the SKU', async () => {
    const outcome = await applyCandidate(payload.asPayload(), SAMPLE_CANDIDATE, makeOptions())

    expect(outcome.status).toBe('created')
    if (outcome.status !== 'created') return
    expect(outcome.productId).toBeGreaterThan(0)
    expect(outcome.mediaReused).toBe(1)
    expect(outcome.mediaUploaded).toBe(0)

    const productCreate = payload.createCalls.find((c) => c.collection === 'products')
    expect(productCreate).toBeDefined()
    expect(productCreate?.locale).toBe('fr')

    const data = productCreate?.data as Record<string, unknown>
    expect(data.sku).toBe('MC9001-2S0007G')
    expect(data.name).toBe('Variateur 0.75 kW')
    expect(data.shortDescription).toBe('Court FR')

    // EN delta should also be persisted via update on the new product.
    const enUpdate = payload.updateCalls.find(
      (u) => u.collection === 'products' && u.locale === 'en',
    )
    expect(enUpdate).toBeDefined()
    expect((enUpdate?.data as Record<string, unknown>).name).toBe('Inverter 0.75 kW')
  })

  it('updates an existing product when the SKU is already known', async () => {
    payload.seed('products', {
      sku: 'MC9001-2S0007G',
      name: 'Old name',
      importMeta: { locked: false },
    })

    const outcome = await applyCandidate(payload.asPayload(), SAMPLE_CANDIDATE, makeOptions())
    expect(outcome.status).toBe('updated')
    if (outcome.status !== 'updated') return
    expect(outcome.productId).toBeGreaterThan(0)

    // No new product was created.
    expect(payload.createCalls.find((c) => c.collection === 'products')).toBeUndefined()

    // Both FR and EN updates were issued.
    const frUpdate = payload.updateCalls.find(
      (u) => u.collection === 'products' && u.locale === 'fr',
    )
    const enUpdate = payload.updateCalls.find(
      (u) => u.collection === 'products' && u.locale === 'en',
    )
    expect(frUpdate).toBeDefined()
    expect(enUpdate).toBeDefined()
  })

  it('skips when the existing product is locked against import', async () => {
    payload.seed('products', {
      sku: 'MC9001-2S0007G',
      name: 'Locked',
      importMeta: { locked: true },
    })

    const outcome = await applyCandidate(payload.asPayload(), SAMPLE_CANDIDATE, makeOptions())
    expect(outcome.status).toBe('skippedLocked')
    if (outcome.status !== 'skippedLocked') return
    expect(outcome.productId).toBeGreaterThan(0)

    // No writes whatsoever.
    expect(payload.createCalls.filter((c) => c.collection === 'products')).toHaveLength(0)
    expect(payload.updateCalls.filter((u) => u.collection === 'products')).toHaveLength(0)
  })

  it('throws when the category is missing and auto-create is disabled', async () => {
    const candidate = { ...SAMPLE_CANDIDATE, categorySlug: 'unknown-category' }
    await expect(
      applyCandidate(payload.asPayload(), candidate, {
        ...makeOptions(),
        allowCreateCategories: false,
      }),
    ).rejects.toThrow(/Category "unknown-category" not found/)
  })

  it('auto-creates a missing category when allowed', async () => {
    const candidate = { ...SAMPLE_CANDIDATE, categorySlug: 'moteurs' }
    // Pre-seed media for moteurs SKU lookup. SAMPLE_CANDIDATE keeps the same
    // SKU so the same media filename applies.
    const outcome = await applyCandidate(payload.asPayload(), candidate, {
      ...makeOptions(),
      allowCreateCategories: true,
    })
    expect(outcome.status).toBe('created')

    const categoryCreate = payload.createCalls.find((c) => c.collection === 'categories')
    expect(categoryCreate).toBeDefined()
    expect((categoryCreate?.data as Record<string, unknown>).slug).toBe('moteurs')
  })

  it('computes a positive priceHT and embeds it in the FR payload', async () => {
    await applyCandidate(payload.asPayload(), SAMPLE_CANDIDATE, makeOptions())
    const productCreate = payload.createCalls.find((c) => c.collection === 'products')
    const data = productCreate?.data as Record<string, unknown>
    const pricing = data.pricing as { priceHT: number }
    expect(pricing.priceHT).toBeGreaterThan(0)
  })

  it('persists fxSnapshot in importMeta', async () => {
    await applyCandidate(payload.asPayload(), SAMPLE_CANDIDATE, makeOptions())
    const productCreate = payload.createCalls.find((c) => c.collection === 'products')
    const data = productCreate?.data as Record<string, unknown>
    const importMeta = data.importMeta as { fxSnapshot: string; source: string }
    expect(typeof importMeta.fxSnapshot).toBe('string')
    expect(importMeta.source).toBe('scan:Nuomake')
    const snapshot = JSON.parse(importMeta.fxSnapshot) as { sourceCurrency: string }
    expect(snapshot.sourceCurrency).toBe('USD')
  })
})
