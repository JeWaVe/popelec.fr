'use client'

import { useTranslations } from 'next-intl'
import { useCart } from '@/components/cart/CartProvider'
import { useState } from 'react'
import type { DomainCartItem } from '@/types/cart'

interface AddToCartButtonProps {
  product: Omit<DomainCartItem, 'quantity'>
}

export function AddToCartButton({ product }: AddToCartButtonProps) {
  const t = useTranslations('common')
  const tProduct = useTranslations('product')
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const handleAdd = () => {
    addItem(product, quantity)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-neutral-700">{tProduct('selectQuantity')}</label>
        <div className="flex items-center border border-neutral-300 rounded-lg">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 py-2 text-neutral-600 hover:text-primary-500 transition-colors"
          >
            -
          </button>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center border-x border-neutral-300 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            min="1"
          />
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="px-3 py-2 text-neutral-600 hover:text-primary-500 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={handleAdd}
        className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
          added
            ? 'bg-green-500'
            : 'bg-accent-500 hover:bg-accent-600'
        }`}
      >
        {added ? tProduct('addedToCart') : t('addToCart')}
      </button>
    </div>
  )
}
