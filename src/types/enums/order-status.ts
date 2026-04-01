export const OrderStatuses = {
  Pending: 'pending',
  Paid: 'paid',
  Processing: 'processing',
  Shipped: 'shipped',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
  Refunded: 'refunded',
} as const

export type OrderStatus = (typeof OrderStatuses)[keyof typeof OrderStatuses]

export const ORDER_STATUS_VALUES = Object.values(OrderStatuses) as unknown as readonly OrderStatus[]
