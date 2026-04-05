import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { OrderStatuses } from '@/types/enums/order-status'
import { TVARates, type TVARate } from '@/types/enums/tva-rate'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 })
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

        // Only create order if payment was actually collected
        if (session.payment_status !== 'paid') {
          console.warn('Checkout session completed but payment_status is', session.payment_status)
          break
        }

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

        // Generate collision-safe order number: POP-YYYYMMDD-XXXXXX
        const now = new Date()
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
        const randomPart = randomBytes(3).toString('hex').toUpperCase()
        const orderNumber = `POP-${datePart}-${randomPart}`

        // Retrieve line items from Stripe with price data expanded
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          expand: ['data.price'],
        })

        // Create order — userId is required (set during checkout)
        const rawUserId = session.metadata?.userId
        if (!rawUserId) {
          console.error('Missing userId in checkout session metadata:', session.id)
          break
        }
        const customerId = parseInt(rawUserId, 10)
        const orderItems = await Promise.all(lineItems.data.map(async (item) => {
          // Retrieve product metadata from the Stripe Price's product
          let payloadId = 0
          let sku = ''
          let tvaRate: TVARate = TVARates.Standard
          if (item.price?.product && typeof item.price.product === 'string') {
            const stripeProduct = await stripe.products.retrieve(item.price.product)
            payloadId = parseInt(stripeProduct.metadata?.payloadId || '0', 10)
            sku = stripeProduct.metadata?.sku || ''

            // Look up the Payload product to get the correct TVA rate
            if (payloadId) {
              try {
                const payloadProduct = await payload.findByID({
                  collection: 'products',
                  id: payloadId,
                })
                tvaRate = (payloadProduct.pricing?.tvaRate as TVARate) || TVARates.Standard
                sku = sku || String(payloadProduct.sku || '')
              } catch {
                // Product may have been deleted — use Stripe metadata
              }
            }
          }

          // Use unit price (amount_total / quantity), not the line total
          const quantity = item.quantity || 1
          const unitPriceHT = item.price?.unit_amount || Math.round((item.amount_total || 0) / quantity)

          return {
            productName: item.description || '',
            sku,
            quantity,
            priceHT: unitPriceHT,
            tvaRate,
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
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 })
  }
}
