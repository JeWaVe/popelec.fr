import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe non configuré' }, { status: 500 })
    }

    const body = await req.json()
    const { items, locale = 'fr' } = body as {
      items: Array<{ productId: string; quantity: number }>
      locale: string
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 })
    }

    const payload = await getPayload()
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
        locale: locale as 'fr' | 'en',
      })

      if (!product || product.status !== 'published') {
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

    const successPath = locale === 'fr' ? '/fr/commande/confirmation' : '/en/checkout/confirmation'
    const cancelPath = locale === 'fr' ? '/fr/panier' : '/en/cart'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${baseUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${cancelPath}`,
      locale: locale === 'fr' ? 'fr' : 'en',
      metadata: {
        source: 'popelec',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
