export const DraftStatuses = {
  Draft: 'draft',
  Published: 'published',
} as const

export type DraftStatus = (typeof DraftStatuses)[keyof typeof DraftStatuses]

export const DRAFT_STATUS_VALUES = Object.values(DraftStatuses) as unknown as readonly DraftStatus[]
