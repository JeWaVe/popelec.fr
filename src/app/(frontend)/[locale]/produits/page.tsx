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
  searchParams: Promise<{ category?: string; sort?: string; page?: string }>
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
  const { category, sort: rawSort, page: pageParam } = await searchParams
  const t = await getTranslations({ locale, namespace: 'products' })
  const payload = await getPayload()
  const currentPage = parseInt(pageParam || '1', 10)
  const sort: ProductSortKey = isProductSortKey(rawSort) ? rawSort : ProductSortKeys.Newest

  // Build query
  const where: Where = { status: { equals: ProductStatuses.Published } }
  if (category) {
    where['categories.slug'] = { equals: category }
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
      <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="md:w-64 flex-shrink-0">
          <h2 className="font-semibold mb-4">{t('allCategories')}</h2>
          <ul className="space-y-2">
            <li>
              <a
                href={`/${locale}/produits`}
                className={`text-sm ${!category ? 'text-primary-500 font-medium' : 'text-neutral-600 hover:text-primary-500'}`}
              >
                {t('allCategories')}
              </a>
            </li>
            {categories.docs.map((cat) => (
              <li key={cat.id}>
                <a
                  href={`/${locale}/produits?category=${cat.slug}`}
                  className={`text-sm ${category === cat.slug ? 'text-primary-500 font-medium' : 'text-neutral-600 hover:text-primary-500'}`}
                >
                  {cat.name}
                </a>
              </li>
            ))}
          </ul>
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
                  href={`/${locale}/produits?${category ? `category=${category}&` : ''}sort=${s}`}
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
                      href={`/${locale}/produits?${category ? `category=${category}&` : ''}${sort !== ProductSortKeys.Newest ? `sort=${sort}&` : ''}page=${p}`}
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
