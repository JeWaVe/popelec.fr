import type { PriceCents } from '@/types/money'
import type { PayloadId } from '@/types/ids'
import type { OrderNumber, SKU, Email, ISODateString } from '@/types/strings'
import type { Quantity } from '@/types/quantity'
import type { OrderStatus } from '@/types/enums/order-status'
import type { QuoteRequestStatus } from '@/types/enums/quote-request-status'
import type { ProductStatus } from '@/types/enums/product-status'
import type { UserRole } from '@/types/enums/user-role'

export interface DashboardMetrics {
  readonly totalOrders: number
  readonly totalRevenueTTC: PriceCents
  readonly pendingOrders: number
  readonly newQuoteRequests: number
}

export interface RecentOrderRow {
  readonly id: PayloadId
  readonly orderNumber: OrderNumber
  readonly customerEmail: Email
  readonly totalTTC: PriceCents
  readonly status: OrderStatus
  readonly createdAt: ISODateString
}

export interface RecentQuoteRow {
  readonly id: PayloadId
  readonly contactName: string
  readonly company: string
  readonly email: Email
  readonly status: QuoteRequestStatus
  readonly createdAt: ISODateString
}

export interface LowStockAlert {
  readonly id: PayloadId
  readonly name: string
  readonly sku: SKU
  readonly quantity: Quantity
  readonly lowStockThreshold: Quantity
}

export type ProductsByStatus = Record<ProductStatus, number>

export type UsersByRole = Record<UserRole, number>

export interface DashboardData {
  readonly metrics: DashboardMetrics
  readonly recentOrders: readonly RecentOrderRow[]
  readonly recentQuotes: readonly RecentQuoteRow[]
  readonly lowStockAlerts: readonly LowStockAlert[]
  readonly productsByStatus: ProductsByStatus
  readonly usersByRole: UsersByRole
}
