import { ProductCard } from './ProductCard'

interface ProductGridProps {
  products: Array<{
    id: string
    slug: string
    name: string
    shortDescription?: string | null
    pricing: {
      priceHT: number
      tvaRate: string
      compareAtPrice?: number | null
    }
    stock: {
      quantity: number
      trackStock: boolean
    }
    images: Array<{
      image: {
        url?: string
        sizes?: {
          card?: { url?: string }
        }
      }
      alt?: string | null
    }>
  }>
  locale: string
}

export function ProductGrid({ products, locale }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} locale={locale} />
      ))}
    </div>
  )
}
