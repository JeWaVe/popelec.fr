import { useTranslations } from 'next-intl'
import { formatPrice, calculateTTC } from '@/lib/formatPrice'
import Image from 'next/image'
import type { Product } from '@/payload-types'

type ProductForCard = Pick<Product, 'slug' | 'name' | 'shortDescription' | 'pricing' | 'stock' | 'images'>

interface ProductCardProps {
  product: ProductForCard
  locale: string
}

export function ProductCard({ product, locale }: ProductCardProps) {
  const t = useTranslations('common')
  const firstImage = product.images?.[0]
  const media = firstImage && typeof firstImage.image !== 'number' ? firstImage.image : null
  const imageUrl = media?.sizes?.card?.url || media?.url
  const imageAlt = firstImage?.alt || product.name
  const priceHT = product.pricing.priceHT
  const priceTTC = calculateTTC(priceHT, product.pricing.tvaRate ?? '20')
  const inStock = !product.stock?.trackStock || (product.stock?.quantity ?? 0) > 0

  return (
    <a
      href={`/${locale}/produits/${product.slug}`}
      className="group bg-white rounded-lg border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all overflow-hidden"
    >
      {/* Image */}
      <div className="aspect-square bg-neutral-100 relative overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {/* Stock badge */}
        {!inStock && (
          <span className="absolute top-2 right-2 bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded">
            {t('outOfStock')}
          </span>
        )}
        {/* Promo badge */}
        {product.pricing.compareAtPrice && product.pricing.compareAtPrice > priceHT && (
          <span className="absolute top-2 left-2 bg-accent-500 text-white text-xs font-bold px-2 py-1 rounded">
            -{Math.round((1 - priceHT / product.pricing.compareAtPrice) * 100)}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-neutral-900 group-hover:text-primary-500 transition-colors line-clamp-2 mb-1">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="text-sm text-neutral-500 line-clamp-2 mb-3">
            {product.shortDescription}
          </p>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary-500">
            {formatPrice(priceHT, locale)} {t('priceHT')}
          </span>
          {product.pricing.compareAtPrice && product.pricing.compareAtPrice > priceHT && (
            <span className="text-sm text-neutral-400 line-through">
              {formatPrice(product.pricing.compareAtPrice, locale)}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-400 mt-0.5">
          {formatPrice(priceTTC, locale)} {t('priceTTC')}
        </p>
      </div>
    </a>
  )
}
