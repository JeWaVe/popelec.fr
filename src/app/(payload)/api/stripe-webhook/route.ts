import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { OrderStatuses } from '@/types/enums/order-status'
import { TVARates } from '@/types/enums/tva-rate'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Webhook secret non configuré' }, { status: 500 })
    }

    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    if (!sig) {
      return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
    }

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )

    const payload = await getPayload()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object

        // Check for duplicate order (idempotency)
        const existing = await payload.find({
          collection: 'orders',
          where: { stripeCheckoutSessionId: { equals: session.id } },
          limit: 1,
        })

        if (existing.docs.length > 0) {
          // Already processed
          break
        }

        // Generate order number
        const orderCount = await payload.count({ collection: 'orders' })
        const orderNumber = `POP-${String(orderCount.totalDocs + 1).padStart(6, '0')}`

        // Retrieve line items from Stripe with price data expanded
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          expand: ['data.price'],
        })

        // Create order
        const customerId = parseInt(session.metadata?.userId || '0', 10)
        const orderItems = await Promise.all(lineItems.data.map(async (item) => {
          // Retrieve product metadata from the Stripe Price's product
          let payloadId = 0
          if (item.price?.product && typeof item.price.product === 'string') {
            const stripeProduct = await stripe.products.retrieve(item.price.product)
            payloadId = parseInt(stripeProduct.metadata?.payloadId || '0', 10)
          }
          return {
            productName: item.description || '',
            sku: '',
            quantity: item.quantity || 1,
            priceHT: item.amount_total || 0,
            tvaRate: TVARates.Standard,
            product: payloadId,
          }
        }))

        await payload.create({
          collection: 'orders',
          data: {
            orderNumber,
            customer: customerId,
            items: orderItems,
            totals: {
              subtotalHT: session.amount_subtotal || 0,
              tva: (session.amount_total || 0) - (session.amount_subtotal || 0),
              totalTTC: session.amount_total || 0,
              shipping: 0,
            },
            status: OrderStatuses.Paid,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id || '',
          },
        })

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object
        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id

        if (paymentIntentId) {
          const orders = await payload.find({
            collection: 'orders',
            where: { stripePaymentIntentId: { equals: paymentIntentId } },
            limit: 1,
          })

          if (orders.docs.length > 0) {
            await payload.update({
              collection: 'orders',
              id: orders.docs[0].id,
              data: { status: OrderStatuses.Refunded },
            })
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook error' },
      { status: 400 }
    )
  }
}
