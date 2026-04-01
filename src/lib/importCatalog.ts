import * as XLSX from 'xlsx'
import type { Payload } from 'payload'
import { ProductStatuses } from '@/types/enums/product-status'
import { TVARates } from '@/types/enums/tva-rate'

interface ImportResult {
  created: number
  updated: number
  errors: Array<{ row: number; message: string }>
  total: number
}

// Default column mapping (can be overridden)
const DEFAULT_COLUMN_MAP: Record<string, string> = {
  'Reference': 'sku',
  'Ref': 'sku',
  'SKU': 'sku',
  'Designation': 'name',
  'Nom': 'name',
  'Name': 'name',
  'Description': 'shortDescription',
  'Prix HT': 'priceHT',
  'Price': 'priceHT',
  'Prix': 'priceHT',
  'Stock': 'stockQuantity',
  'Quantite': 'stockQuantity',
  'Qty': 'stockQuantity',
  'Categorie': 'category',
  'Category': 'category',
  'Poids': 'weight',
  'Weight': 'weight',
}

function normalizeColumnName(col: string): string {
  return col.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findMapping(header: string): string | null {
  const normalized = normalizeColumnName(header)
  for (const [key, value] of Object.entries(DEFAULT_COLUMN_MAP)) {
    if (normalizeColumnName(key) === normalized) return value
  }
  return null
}

export async function importFromExcel(
  buffer: Buffer,
  payload: Payload,
  dryRun: boolean = false
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  const result: ImportResult = { created: 0, updated: 0, errors: [], total: rows.length }

  // Detect column mapping from headers
  const headers = Object.keys(rows[0] || {})
  const mapping: Record<string, string> = {}
  for (const header of headers) {
    const mapped = findMapping(header)
    if (mapped) mapping[header] = mapped
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // +2 for header row + 0-indexed

    try {
      // Extract mapped values
      const mapped: Record<string, unknown> = {}
      for (const [col, field] of Object.entries(mapping)) {
        mapped[field] = row[col]
      }

      if (!mapped.sku) {
        result.errors.push({ row: rowNum, message: 'SKU manquant' })
        continue
      }

      if (!mapped.name) {
        result.errors.push({ row: rowNum, message: 'Nom manquant' })
        continue
      }

      const sku = String(mapped.sku).trim()
      const name = String(mapped.name).trim()
      const slug = name
        .toLowerCase()
        .replace(/[éèêë]/g, 'e')
        .replace(/[àâä]/g, 'a')
        .replace(/[ùûü]/g, 'u')
        .replace(/[ôö]/g, 'o')
        .replace(/[îï]/g, 'i')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Parse price (handle both cents and euros)
      let priceHT = 0
      if (mapped.priceHT) {
        const priceStr = String(mapped.priceHT).replace(',', '.').replace(/[^0-9.]/g, '')
        const priceNum = parseFloat(priceStr)
        // If price looks like euros (< 100000), convert to cents
        priceHT = priceNum < 100000 ? Math.round(priceNum * 100) : Math.round(priceNum)
      }

      const stockQuantity = mapped.stockQuantity ? parseInt(String(mapped.stockQuantity), 10) || 0 : 0

      if (dryRun) {
        result.created++
        continue
      }

      // Check if product exists
      const existing = await payload.find({
        collection: 'products',
        where: { sku: { equals: sku } },
        limit: 1,
      })

      // Resolve category if provided
      let categoryIds: number[] = []
      if (mapped.category) {
        const catName = String(mapped.category).trim()
        const catResult = await payload.find({
          collection: 'categories',
          where: { name: { equals: catName } },
          limit: 1,
        })
        if (catResult.docs.length > 0) {
          categoryIds = [catResult.docs[0].id]
        }
      }

      const productData = {
        name,
        slug,
        sku,
        status: ProductStatuses.Draft,
        shortDescription: mapped.shortDescription ? String(mapped.shortDescription) : undefined,
        pricing: {
          priceHT,
          tvaRate: TVARates.Standard,
        },
        stock: {
          quantity: stockQuantity,
          trackStock: true,
          lowStockThreshold: 5,
        },
        physical: {
          weight: mapped.weight ? parseFloat(String(mapped.weight)) : undefined,
        },
        ...(categoryIds.length > 0 ? { categories: categoryIds } : {}),
      }

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'products',
          id: existing.docs[0].id,
          draft: true,
          data: productData,
        })
        result.updated++
      } else {
        await payload.create({
          collection: 'products',
          draft: true,
          data: productData,
        })
        result.created++
      }
    } catch (err) {
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : 'Erreur inconnue',
      })
    }
  }

  return result
}
