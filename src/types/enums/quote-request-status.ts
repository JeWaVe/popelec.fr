export const QuoteRequestStatuses = {
  New: 'new',
  Processing: 'processing',
  Sent: 'sent',
  Accepted: 'accepted',
  Rejected: 'rejected',
} as const

export type QuoteRequestStatus = (typeof QuoteRequestStatuses)[keyof typeof QuoteRequestStatuses]

export const QUOTE_REQUEST_STATUS_VALUES = Object.values(QuoteRequestStatuses) as unknown as readonly QuoteRequestStatus[]
