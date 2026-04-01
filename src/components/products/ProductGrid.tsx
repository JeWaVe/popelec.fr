import { ProductCard } from './ProductCard'
import type { Product } from '@/payload-types'
import type { Locale } from '@/types/enums/locale'

type ProductForGrid = Pick<Product, 'id' | 'slug' | 'name' | 'shortDescription' | 'pricing' | 'stock' | 'images'>

interface ProductGridProps {
  products: ProductForGrid[]
  locale: Locale
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
