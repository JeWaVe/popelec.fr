import { describe, it, expect } from 'vitest'
import { ProductStatuses, PRODUCT_STATUS_VALUES } from '@/types/enums/product-status'
import { OrderStatuses, ORDER_STATUS_VALUES } from '@/types/enums/order-status'
import { QuoteRequestStatuses, QUOTE_REQUEST_STATUS_VALUES } from '@/types/enums/quote-request-status'
import { UserRoles, USER_ROLE_VALUES } from '@/types/enums/user-role'
import { DraftStatuses, DRAFT_STATUS_VALUES } from '@/types/enums/draft-status'
import { Countries, COUNTRY_VALUES } from '@/types/enums/country'

describe('ProductStatuses', () => {
  it('has all expected values', () => {
    expect(ProductStatuses.Draft).toBe('draft')
    expect(ProductStatuses.Published).toBe('published')
    expect(ProductStatuses.OutOfStock).toBe('outOfStock')
    expect(ProductStatuses.Archived).toBe('archived')
  })

  it('VALUES array matches enum', () => {
    expect(PRODUCT_STATUS_VALUES).toHaveLength(4)
    expect(PRODUCT_STATUS_VALUES).toContain('draft')
    expect(PRODUCT_STATUS_VALUES).toContain('published')
  })
})

describe('OrderStatuses', () => {
  it('has all expected values', () => {
    expect(OrderStatuses.Pending).toBe('pending')
    expect(OrderStatuses.Paid).toBe('paid')
    expect(OrderStatuses.Shipped).toBe('shipped')
    expect(OrderStatuses.Delivered).toBe('delivered')
    expect(OrderStatuses.Cancelled).toBe('cancelled')
    expect(OrderStatuses.Refunded).toBe('refunded')
  })

  it('VALUES array matches enum', () => {
    expect(ORDER_STATUS_VALUES).toHaveLength(7)
  })
})

describe('QuoteRequestStatuses', () => {
  it('has all expected values', () => {
    expect(QuoteRequestStatuses.New).toBe('new')
    expect(QuoteRequestStatuses.Processing).toBe('processing')
    expect(QuoteRequestStatuses.Sent).toBe('sent')
    expect(QuoteRequestStatuses.Accepted).toBe('accepted')
    expect(QuoteRequestStatuses.Rejected).toBe('rejected')
  })

  it('VALUES array matches enum', () => {
    expect(QUOTE_REQUEST_STATUS_VALUES).toHaveLength(5)
  })
})

describe('UserRoles', () => {
  it('has all expected values', () => {
    expect(UserRoles.Admin).toBe('admin')
    expect(UserRoles.Customer).toBe('customer')
    expect(UserRoles.Professional).toBe('professional')
  })

  it('VALUES array matches enum', () => {
    expect(USER_ROLE_VALUES).toHaveLength(3)
  })
})

describe('DraftStatuses', () => {
  it('has all expected values', () => {
    expect(DraftStatuses.Draft).toBe('draft')
    expect(DraftStatuses.Published).toBe('published')
  })

  it('VALUES array matches enum', () => {
    expect(DRAFT_STATUS_VALUES).toHaveLength(2)
  })
})

describe('Countries', () => {
  it('has all expected values', () => {
    expect(Countries.FR).toBe('FR')
    expect(Countries.DE).toBe('DE')
    expect(Countries.BE).toBe('BE')
    expect(Countries.GB).toBe('GB')
  })

  it('VALUES array matches enum', () => {
    expect(COUNTRY_VALUES).toHaveLength(8)
  })
})
