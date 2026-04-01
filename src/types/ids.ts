import type { Brand } from './brand'

/** Payload CMS document ID (auto-incremented integer). */
export type PayloadId = Brand<number, 'PayloadId'>

export function payloadId(raw: number): PayloadId {
  return raw as PayloadId
}
