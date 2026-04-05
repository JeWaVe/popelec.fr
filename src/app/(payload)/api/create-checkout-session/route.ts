import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { parseLocale, Locales } from '@/types/enums/locale'
import { ProductStatuses } from '@/types/enums/product-status'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const blocked = rateLimit(getClientIp(req), 'checkout', { limit: 10, windowSec: 60 })
    if (blocked) return blocked

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 500 })
    }

    const payload = await getPayload()

    // Authenticate user — required for checkout
    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    const body = await req.json()
    const { items, locale: rawLocale = 'fr' } = body as {
      items: Array<{ productId: string; quantity: number }>
      locale: string
    }
    const locale = parseLocale(rawLocale)

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 })
    }

    // Validate quantities — must be positive integers, capped at 999
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
        return NextResponse.json(
          { error: 'Quantité invalide' },
          { status: 400 },
        )
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    // Fetch products and validate
    const lineItems: Array<{
      price_data: {
        currency: string
        product_data: { name: string; metadata: Record<string, string> }
        unit_amount: number
        tax_behavior: 'exclusive'
      }
      quantity: number
    }> = []

    for (const item of items) {
      const product = await payload.findByID({
        collection: 'products',
        id: item.productId,
        locale,
      })

      if (!product || product.status !== ProductStatuses.Published) {
        return NextResponse.json(
          { error: `Produit ${item.productId} non disponible` },
          { status: 400 }
        )
      }

      if (product.stock?.trackStock && (product.stock?.quantity ?? 0) < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuffisant pour ${product.name}` },
          { status: 400 }
        )
      }

      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: product.name,
            metadata: {
              payloadId: String(product.id),
              sku: String(product.sku),
            },
          },
          unit_amount: product.pricing.priceHT,
          tax_behavior: 'exclusive',
        },
        quantity: item.quantity,
      })
    }

    const successPath = locale === Locales.Fr ? '/fr/commande/confirmation' : '/en/checkout/confirmation'
    const cancelPath = locale === Locales.Fr ? '/fr/panier' : '/en/cart'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${baseUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelPath}`,
      locale: locale === Locales.Fr ? 'fr' : 'en',
      metadata: {
        source: 'popelec',
        userId: String(user.id),
      },
      customer_email: user.email as string,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
