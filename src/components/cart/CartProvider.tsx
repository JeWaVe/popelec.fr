'use client'

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import type { DomainCartItem, DomainCartContext, CartProductId } from '@/types/cart'
import { priceCents } from '@/types/money'
import { cartItemsFromJSON } from '@/types/converters'

const CartContext = createContext<DomainCartContext | null>(null)

const CART_KEY = 'popelec-cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DomainCartItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY)
      if (stored) {
        setItems(cartItemsFromJSON(JSON.parse(stored)))
      }
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(CART_KEY, JSON.stringify(items))
    }
  }, [items, loaded])

  const addItem = useCallback((item: Omit<DomainCartItem, 'quantity'>, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId)
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      }
      return [...prev, { ...item, quantity }]
    })
  }, [])

  const removeItem = useCallback((productId: CartProductId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }, [])

  const updateQuantity = useCallback((productId: CartProductId, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId))
    } else {
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
      )
    }
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotalHT = priceCents(items.reduce((sum, i) => sum + i.priceHT * i.quantity, 0))

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotalHT }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): DomainCartContext {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
