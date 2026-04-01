import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { ProductGrid } from '@/components/products/ProductGrid'
import { notFound } from 'next/navigation'
import { parseLocale, type Locale } from '@/types/enums/locale'
import { ProductStatuses } from '@/types/enums/product-status'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params
  const locale: Locale = parseLocale(rawLocale)
  const payload = await getPayload()
  const result = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
  })
  const category = result.docs[0]
  if (!category) return {}

  return {
    title: `${category.meta?.title || category.name} | popelec.fr`,
    description: category.meta?.description || '',
  }
}

export default async function CategoryPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params
  const locale: Locale = parseLocale(rawLocale)
  setRequestLocale(locale)

  const payload = await getPayload()

  const catResult = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
  })
  const category = catResult.docs[0]
  if (!category) notFound()

  const products = await payload.find({
    collection: 'products',
    where: {
      status: { equals: ProductStatuses.Published },
      categories: { contains: category.id },
    },
    locale,
    limit: 24,
    depth: 2,
  })

  // Fetch subcategories
  const subcategories = await payload.find({
    collection: 'categories',
    where: { parent: { equals: category.id } },
    sort: 'sortOrder',
    locale,
    limit: 20,
  })

  const t = await getTranslations({ locale, namespace: 'products' })

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <nav className="text-sm text-neutral-500 mb-6">
        <a href={`/${locale}/produits`} className="hover:text-primary-500">
          {t('title')}
        </a>
        <span className="mx-2">/</span>
        <span className="text-neutral-900">{category.name}</span>
      </nav>

      <h1 className="text-3xl font-bold mb-4">{category.name}</h1>

      {/* Subcategories */}
      {subcategories.docs.length > 0 && (
        <div className="flex gap-3 mb-8 flex-wrap">
          {subcategories.docs.map((sub) => (
            <a
              key={sub.id}
              href={`/${locale}/categories/${sub.slug}`}
              className="px-4 py-2 border border-neutral-200 rounded-full text-sm text-neutral-700 hover:border-primary-300 hover:text-primary-500 transition-colors"
            >
              {sub.name}
            </a>
          ))}
        </div>
      )}

      {products.docs.length > 0 ? (
        <ProductGrid products={products.docs} locale={locale} />
      ) : (
        <p className="text-neutral-500 text-center py-12">{t('noResults')}</p>
      )}
    </div>
  )
}
