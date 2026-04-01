import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { ProductGrid } from '@/components/products/ProductGrid'
import { parseLocale, type Locale } from '@/types/enums/locale'
import { ProductStatuses } from '@/types/enums/product-status'
import { ProductSortKeys, isProductSortKey, type ProductSortKey } from '@/types/enums/product-sort-key'
import type { Metadata } from 'next'
import type { Where } from 'payload'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    category?: string
    sort?: string
    page?: string
    q?: string
    inStock?: string
    minPrice?: string
    maxPrice?: string
  }>
}

function buildQuery(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale } = await params
  const locale = parseLocale(rawLocale)
  const t = await getTranslations({ locale, namespace: 'products' })
  return {
    title: `${t('title')} | popelec.fr`,
  }
}

const SORT_MAP: Record<ProductSortKey, string> = {
  [ProductSortKeys.Newest]: '-createdAt',
  [ProductSortKeys.PriceAsc]: 'pricing.priceHT',
  [ProductSortKeys.PriceDesc]: '-pricing.priceHT',
  [ProductSortKeys.Name]: 'name',
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params
  const locale: Locale = parseLocale(rawLocale)
  setRequestLocale(locale)
  const { category, sort: rawSort, page: pageParam, q, inStock, minPrice, maxPrice } = await searchParams
  const t = await getTranslations({ locale, namespace: 'products' })
  const tSearch = await getTranslations({ locale, namespace: 'search' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const payload = await getPayload()
  const currentPage = parseInt(pageParam || '1', 10)
  const sort: ProductSortKey = isProductSortKey(rawSort) ? rawSort : ProductSortKeys.Newest
  const searchQuery = q?.trim() || ''
  const inStockOnly = inStock === '1'
  const minPriceCents = minPrice ? Math.round(parseFloat(minPrice) * 100) : undefined
  const maxPriceCents = maxPrice ? Math.round(parseFloat(maxPrice) * 100) : undefined

  // Shared query params for link building
  const baseParams: Record<string, string | undefined> = {
    category,
    q: searchQuery || undefined,
    inStock: inStockOnly ? '1' : undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
  }

  // Build query
  const where: Where = { status: { equals: ProductStatuses.Published } }
  if (category) {
    where['categories.slug'] = { equals: category }
  }
  if (searchQuery) {
    where.or = [
      { name: { like: searchQuery } },
      { sku: { like: searchQuery } },
      { shortDescription: { like: searchQuery } },
    ]
  }
  if (inStockOnly) {
    where['stock.quantity'] = { greater_than: 0 }
  }
  if (minPriceCents !== undefined) {
    where['pricing.priceHT'] = { ...(where['pricing.priceHT'] as Record<string, unknown> ?? {}), greater_than_equal: minPriceCents }
  }
  if (maxPriceCents !== undefined) {
    where['pricing.priceHT'] = { ...(where['pricing.priceHT'] as Record<string, unknown> ?? {}), less_than_equal: maxPriceCents }
  }

  const products = await payload.find({
    collection: 'products',
    where,
    sort: SORT_MAP[sort],
    locale,
    page: currentPage,
    limit: 12,
    depth: 2,
  })

  const categories = await payload.find({
    collection: 'categories',
    where: { parent: { exists: false } },
    sort: 'sortOrder',
    locale,
    limit: 20,
  })

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
      {searchQuery && (
        <p className="text-neutral-500 mb-6">{tSearch('resultsFor', { query: searchQuery })}</p>
      )}
      {!searchQuery && <div className="mb-6" />}

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="md:w-64 flex-shrink-0 space-y-6">
          <div>
            <h2 className="font-semibold mb-4">{t('allCategories')}</h2>
            <ul className="space-y-2">
              <li>
                <a
                  href={`/${locale}/produits${buildQuery({ ...baseParams, category: undefined })}`}
                  className={`text-sm ${!category ? 'text-primary-500 font-medium' : 'text-neutral-600 hover:text-primary-500'}`}
                >
                  {t('allCategories')}
                </a>
              </li>
              {categories.docs.map((cat) => (
                <li key={cat.id}>
                  <a
                    href={`/${locale}/produits${buildQuery({ ...baseParams, category: cat.slug })}`}
                    className={`text-sm ${category === cat.slug ? 'text-primary-500 font-medium' : 'text-neutral-600 hover:text-primary-500'}`}
                  >
                    {cat.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* In stock filter */}
          <div>
            <h3 className="font-semibold mb-3 text-sm">{t('filters')}</h3>
            <a
              href={`/${locale}/produits${buildQuery({ ...baseParams, inStock: inStockOnly ? undefined : '1' })}`}
              className={`flex items-center gap-2 text-sm ${inStockOnly ? 'text-primary-500 font-medium' : 'text-neutral-600 hover:text-primary-500'}`}
            >
              <span className={`w-4 h-4 border rounded flex items-center justify-center ${inStockOnly ? 'bg-primary-500 border-primary-500' : 'border-neutral-300'}`}>
                {inStockOnly && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {t('inStockOnly')}
            </a>
          </div>

          {/* Price range filter */}
          <div>
            <h3 className="font-semibold mb-3 text-sm">{t('priceRange')}</h3>
            <form action={`/${locale}/produits`} method="GET" className="space-y-2">
              {/* Carry forward existing params as hidden fields */}
              {category && <input type="hidden" name="category" value={category} />}
              {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
              {inStockOnly && <input type="hidden" name="inStock" value="1" />}
              {sort !== ProductSortKeys.Newest && <input type="hidden" name="sort" value={sort} />}
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  name="minPrice"
                  defaultValue={minPrice || ''}
                  placeholder="Min"
                  min="0"
                  step="0.01"
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  aria-label={`${t('priceRange')} min`}
                />
                <span className="text-neutral-400 text-sm">-</span>
                <input
                  type="number"
                  name="maxPrice"
                  defaultValue={maxPrice || ''}
                  placeholder="Max"
                  min="0"
                  step="0.01"
                  className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  aria-label={`${t('priceRange')} max`}
                />
                <span className="text-xs text-neutral-400">{tCommon('priceHT')}</span>
              </div>
              <button
                type="submit"
                className="w-full bg-primary-500 hover:bg-primary-600 text-white text-sm py-1.5 rounded transition-colors"
              >
                {t('filters')}
              </button>
              {(minPrice || maxPrice) && (
                <a
                  href={`/${locale}/produits${buildQuery({ ...baseParams, minPrice: undefined, maxPrice: undefined })}`}
                  className="block text-center text-xs text-primary-500 hover:underline"
                >
                  {tCommon('back')}
                </a>
              )}
            </form>
          </div>
        </aside>

        {/* Products */}
        <div className="flex-1">
          {/* Sort + count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-neutral-500">
              {t('results', { count: products.totalDocs })}
            </p>
            <div className="flex gap-2 text-sm">
              <span className="text-neutral-400">{t('sortBy')} :</span>
              {([ProductSortKeys.Newest, ProductSortKeys.PriceAsc, ProductSortKeys.PriceDesc, ProductSortKeys.Name] as const).map((s) => (
                <a
                  key={s}
                  href={`/${locale}/produits${buildQuery({ ...baseParams, sort: s !== ProductSortKeys.Newest ? s : undefined })}`}
                  className={`${sort === s ? 'text-primary-500 font-medium' : 'text-neutral-600 hover:text-primary-500'}`}
                >
                  {t(`sort${s.charAt(0).toUpperCase() + s.slice(1)}`)}
                </a>
              ))}
            </div>
          </div>

          {products.docs.length > 0 ? (
            <>
              <ProductGrid products={products.docs} locale={locale} />

              {/* Pagination */}
              {products.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: products.totalPages }, (_, i) => i + 1).map((p) => (
                    <a
                      key={p}
                      href={`/${locale}/produits${buildQuery({ ...baseParams, sort: sort !== ProductSortKeys.Newest ? sort : undefined, page: p > 1 ? String(p) : undefined })}`}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm ${
                        p === currentPage
                          ? 'bg-primary-500 text-white'
                          : 'border border-neutral-300 text-neutral-600 hover:border-primary-300'
                      }`}
                    >
                      {p}
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-neutral-500 text-center py-12">{t('noResults')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
