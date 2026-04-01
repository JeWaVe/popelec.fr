import type { Payload } from 'payload'
import type { Order, Product, User } from '@/payload-types'
import type {
  DashboardData,
  DashboardMetrics,
  RecentOrderRow,
  RecentQuoteRow,
  LowStockAlert,
  ProductsByStatus,
  UsersByRole,
} from './dashboard-types'
import { priceCents } from '@/types/money'
import { payloadId } from '@/types/ids'
import { orderNumber, sku, email, isoDateString } from '@/types/strings'
import { quantity } from '@/types/quantity'
import { OrderStatuses, type OrderStatus } from '@/types/enums/order-status'
import { PRODUCT_STATUS_VALUES } from '@/types/enums/product-status'
import { QuoteRequestStatuses, type QuoteRequestStatus } from '@/types/enums/quote-request-status'
import { USER_ROLE_VALUES } from '@/types/enums/user-role'

function extractCustomerEmail(customer: Order['customer']): string {
  if (typeof customer === 'object' && customer !== null) {
    return (customer as User).email
  }
  return '—'
}

export async function fetchDashboardData(payload: Payload): Promise<DashboardData> {
  const [
    totalOrdersResult,
    pendingOrdersResult,
    newQuotesResult,
    paidOrdersResult,
    recentOrdersResult,
    recentQuotesResult,
    trackedStockProducts,
    productStatusCounts,
    userRoleCounts,
  ] = await Promise.all([
    // Total orders
    payload.count({ collection: 'orders' }),

    // Pending orders
    payload.count({
      collection: 'orders',
      where: { status: { equals: OrderStatuses.Pending } },
    }),

    // New quote requests
    payload.count({
      collection: 'quote-requests',
      where: { status: { equals: QuoteRequestStatuses.New } },
    }),

    // All non-cancelled/refunded orders for revenue
    payload.find({
      collection: 'orders',
      pagination: false,
      where: {
        status: {
          not_in: [OrderStatuses.Cancelled, OrderStatuses.Refunded],
        },
      },
      select: {
        totals: { totalTTC: true },
      },
    }),

    // Recent 10 orders
    payload.find({
      collection: 'orders',
      sort: '-createdAt',
      limit: 10,
      depth: 1,
      select: {
        orderNumber: true,
        customer: true,
        totals: { totalTTC: true },
        status: true,
        createdAt: true,
      },
    }),

    // Recent 5 quotes
    payload.find({
      collection: 'quote-requests',
      sort: '-createdAt',
      limit: 5,
      select: {
        contactName: true,
        company: true,
        email: true,
        status: true,
        createdAt: true,
      },
    }),

    // Products with stock tracking for low-stock alerts
    payload.find({
      collection: 'products',
      pagination: false,
      where: {
        'stock.trackStock': { equals: true },
        status: { equals: 'published' },
      },
      select: {
        name: true,
        sku: true,
        stock: { quantity: true, lowStockThreshold: true },
      },
    }),

    // Products by status
    Promise.all(
      PRODUCT_STATUS_VALUES.map(async (status) => {
        const result = await payload.count({
          collection: 'products',
          where: { status: { equals: status } },
        })
        return [status, result.totalDocs] as const
      }),
    ),

    // Users by role
    Promise.all(
      USER_ROLE_VALUES.map(async (role) => {
        const result = await payload.count({
          collection: 'users',
          where: { role: { equals: role } },
        })
        return [role, result.totalDocs] as const
      }),
    ),
  ])

  // Compute total revenue
  const totalRevenue = paidOrdersResult.docs.reduce(
    (sum, order) => sum + (order.totals?.totalTTC ?? 0),
    0,
  )

  // Build metrics
  const metrics: DashboardMetrics = {
    totalOrders: totalOrdersResult.totalDocs,
    totalRevenueTTC: priceCents(totalRevenue),
    pendingOrders: pendingOrdersResult.totalDocs,
    newQuoteRequests: newQuotesResult.totalDocs,
  }

  // Map recent orders
  const recentOrders: RecentOrderRow[] = recentOrdersResult.docs.map((o) => ({
    id: payloadId(o.id),
    orderNumber: orderNumber(o.orderNumber ?? ''),
    customerEmail: email(extractCustomerEmail(o.customer)),
    totalTTC: priceCents(o.totals?.totalTTC ?? 0),
    status: (o.status ?? OrderStatuses.Pending) as OrderStatus,
    createdAt: isoDateString(o.createdAt),
  }))

  // Map recent quotes
  const recentQuotes: RecentQuoteRow[] = recentQuotesResult.docs.map((q) => ({
    id: payloadId(q.id),
    contactName: q.contactName ?? '',
    company: q.company ?? '',
    email: email(q.email ?? ''),
    status: (q.status ?? QuoteRequestStatuses.New) as QuoteRequestStatus,
    createdAt: isoDateString(q.createdAt),
  }))

  // Filter low stock products
  const lowStockAlerts: LowStockAlert[] = (trackedStockProducts.docs as Product[])
    .filter((p) => {
      const qty = p.stock?.quantity ?? 0
      const threshold = p.stock?.lowStockThreshold ?? 5
      return qty <= threshold
    })
    .map((p) => ({
      id: payloadId(p.id),
      name: p.name,
      sku: sku(p.sku),
      quantity: quantity(p.stock?.quantity ?? 0),
      lowStockThreshold: quantity(p.stock?.lowStockThreshold ?? 5),
    }))
    .sort((a, b) => (a.quantity as number) - (b.quantity as number))

  // Build status/role maps
  const productsByStatus = Object.fromEntries(productStatusCounts) as ProductsByStatus
  const usersByRole = Object.fromEntries(userRoleCounts) as UsersByRole

  return {
    metrics,
    recentOrders,
    recentQuotes,
    lowStockAlerts,
    productsByStatus,
    usersByRole,
  }
}
