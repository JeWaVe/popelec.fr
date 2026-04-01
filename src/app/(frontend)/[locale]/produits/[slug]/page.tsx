import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPayload } from '@/lib/payload'
import { formatPrice, calculateTTC } from '@/lib/formatPrice'
import { AddToCartButton } from '@/components/products/AddToCartButton'
import { ProductGrid } from '@/components/products/ProductGrid'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { parseLocale, type Locale } from '@/types/enums/locale'
import { ProductStatuses } from '@/types/enums/product-status'
import { TVARates, type TVARate } from '@/types/enums/tva-rate'
import type { PriceCents } from '@/types/money'
import { priceCents } from '@/types/money'
import { cartProductId } from '@/types/cart'
import { productSlug as toProductSlug } from '@/types/strings'
import { sku as toSKU } from '@/types/strings'
import { imageUrl as toImageUrl } from '@/types/strings'
import type { Metadata } from 'next'
import type { Product } from '@/payload-types'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params
  const locale: Locale = parseLocale(rawLocale)
  const payload = await getPayload()
  const result = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  })
  const product = result.docs[0]
  if (!product) return {}

  return {
    title: `${product.meta?.title || product.name} | popelec.fr`,
    description: product.meta?.description || product.shortDescription || '',
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params
  const locale: Locale = parseLocale(rawLocale)
  setRequestLocale(locale)

  const payload = await getPayload()
  const result = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug }, status: { equals: ProductStatuses.Published } },
    locale,
    limit: 1,
    depth: 2,
  })
  const product = result.docs[0]
  if (!product) notFound()

  const t = await getTranslations({ locale, namespace: 'product' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  const priceHT = product.pricing.priceHT as PriceCents
  const tvaRate = (product.pricing.tvaRate || TVARates.Standard) as TVARate
  const priceTTC = calculateTTC(priceHT, tvaRate)
  const stock = product.stock
  const inStock = !stock?.trackStock || (stock?.quantity ?? 0) > 0

  // Fetch related products
  let relatedProducts: typeof result.docs = []
  if (product.relatedProducts && product.relatedProducts.length > 0) {
    const relatedIds = product.relatedProducts.map((p) =>
      typeof p === 'number' ? p : p.id
    )
    const relatedResult = await payload.find({
      collection: 'products',
      where: { id: { in: relatedIds }, status: { equals: ProductStatuses.Published } },
      locale,
      limit: 4,
      depth: 2,
    })
    relatedProducts = relatedResult.docs
  }

  // Group specs by group name
  type Spec = NonNullable<Product['specs']>[number]
  const specGroups = (product.specs || []).reduce<Record<string, Spec[]>>(
    (acc, spec) => {
      const group = spec.group || 'Général'
      if (!acc[group]) acc[group] = []
      acc[group].push(spec)
      return acc
    },
    {}
  )

  const mainImage = product.images?.[0]
  const mainMedia = mainImage && typeof mainImage.image !== 'number' ? mainImage.image : null
  const mainImageUrl = mainMedia?.sizes?.product?.url || mainMedia?.url

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Breadcrumbs */}
      <nav className="text-sm text-neutral-500 mb-6">
        <a href={`/${locale}/produits`} className="hover:text-primary-500">
          {tCommon('viewProducts')}
        </a>
        <span className="mx-2">/</span>
        <span className="text-neutral-900">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="aspect-square bg-neutral-100 rounded-lg overflow-hidden relative mb-4">
            {mainImageUrl ? (
              <Image
                src={mainImageUrl}
                alt={(mainImage?.alt as string) || product.name}
                fill
                className="object-contain p-6"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-400">
                <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          {/* Thumbnails */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => {
                const imgMedia = typeof img.image !== 'number' ? img.image : null
                const thumbUrl = imgMedia?.sizes?.thumbnail?.url || imgMedia?.url
                return (
                  <div
                    key={i}
                    className="w-20 h-20 flex-shrink-0 bg-neutral-100 rounded-lg overflow-hidden relative border-2 border-transparent hover:border-primary-300"
                  >
                    {thumbUrl && (
                      <Image
                        src={thumbUrl}
                        alt={img.alt || ''}
                        fill
                        className="object-contain p-1"
                        sizes="80px"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Product info */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-neutral-900 mb-2">
            {product.name}
          </h1>
          <p className="text-sm text-neutral-500 mb-4">
            {t('sku')} {product.sku}
          </p>

          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary-500">
                {formatPrice(priceHT, locale)}
              </span>
              <span className="text-sm text-neutral-500">{tCommon('priceHT')}</span>
              {product.pricing.compareAtPrice && product.pricing.compareAtPrice > priceHT && (
                <span className="text-lg text-neutral-400 line-through">
                  {formatPrice(product.pricing.compareAtPrice as PriceCents, locale)}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-400 mt-1">
              {formatPrice(priceTTC, locale)} {tCommon('priceTTC')}
            </p>
          </div>

          {/* Stock status */}
          <div className="mb-6">
            {inStock ? (
              <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {tCommon('inStock')}
                {stock?.trackStock && (stock?.quantity ?? 0) <= (stock?.lowStockThreshold ?? 5) && (
                  <span className="text-amber-600 ml-2">({tCommon('lowStock')})</span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-red-600 text-sm font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                {tCommon('outOfStock')}
              </span>
            )}
          </div>

          {/* Short description */}
          {product.shortDescription && (
            <p className="text-neutral-600 mb-6">{product.shortDescription}</p>
          )}

          {/* Add to cart */}
          {inStock && (
            <div className="mb-6">
              <AddToCartButton
                product={{
                  productId: cartProductId(String(product.id)),
                  name: product.name,
                  slug: toProductSlug(product.slug),
                  sku: toSKU(product.sku),
                  priceHT: priceCents(product.pricing.priceHT),
                  tvaRate,
                  ...(mainImageUrl ? { image: toImageUrl(mainImageUrl) } : {}),
                }}
              />
            </div>
          )}

          {/* Quote link */}
          <a
            href={`/${locale}/devis`}
            className="text-sm text-primary-500 hover:underline"
          >
            {t('bulkOrder')}
          </a>
        </div>
      </div>

      {/* Tabs: Description, Specs, Datasheets */}
      <div className="mt-12 border-t border-neutral-200 pt-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Description */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold mb-4">{t('description')}</h2>
            <div className="prose prose-neutral max-w-none">
              {/* Rich text rendering would go here */}
              {product.shortDescription && <p>{product.shortDescription}</p>}
            </div>
          </div>

          {/* Specs */}
          <div>
            <h2 className="text-xl font-bold mb-4">{t('specifications')}</h2>
            {Object.entries(specGroups).map(([group, specs]) => (
              <div key={group} className="mb-4">
                <h3 className="text-sm font-semibold text-neutral-500 uppercase mb-2">
                  {group}
                </h3>
                <dl className="space-y-1">
                  {specs.map((spec, i) => (
                    <div key={i} className="flex justify-between text-sm py-1 border-b border-neutral-100">
                      <dt className="text-neutral-600">{spec.label}</dt>
                      <dd className="font-medium text-neutral-900">
                        {spec.value}
                        {spec.unit && <span className="text-neutral-500 ml-1">{spec.unit}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}

            {/* Datasheets */}
            {product.datasheets && product.datasheets.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xl font-bold mb-4">{t('datasheets')}</h2>
                <ul className="space-y-2">
                  {product.datasheets.map((ds, i) => {
                    const fileMedia = typeof ds.file !== 'number' ? ds.file : null
                    return (
                    <li key={i}>
                      <a
                        href={fileMedia?.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary-500 hover:underline text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {ds.title} ({t('download')})
                      </a>
                    </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <div className="mt-12 border-t border-neutral-200 pt-8">
          <h2 className="text-xl font-bold mb-6">{t('relatedProducts')}</h2>
          <ProductGrid products={relatedProducts} locale={locale} />
        </div>
      )}
    </div>
  )
}
