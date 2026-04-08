import { type ProductSlug, productSlug } from '@/types/strings'

/**
 * Normalize a string into a URL-safe slug.
 *
 * - Strips diacritics via NFD normalization (`café` → `cafe`)
 * - Lowercases everything
 * - Replaces any run of non-alphanumeric characters with a single dash
 * - Trims leading/trailing dashes
 *
 * Returns a branded {@link ProductSlug}. The same shape works for category and
 * page slugs — callers can re-brand if needed.
 */
export function slugify(input: string): ProductSlug {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return productSlug(normalized)
}
