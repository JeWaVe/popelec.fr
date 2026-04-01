import type { Brand } from './brand'

export type ProductSlug = Brand<string, 'ProductSlug'>
export type CategorySlug = Brand<string, 'CategorySlug'>
export type PageSlug = Brand<string, 'PageSlug'>
export type SKU = Brand<string, 'SKU'>
export type OrderNumber = Brand<string, 'OrderNumber'>
export type Email = Brand<string, 'Email'>
export type Phone = Brand<string, 'Phone'>
export type SIRET = Brand<string, 'SIRET'>
export type VATNumber = Brand<string, 'VATNumber'>
export type PostalCode = Brand<string, 'PostalCode'>
export type ImageUrl = Brand<string, 'ImageUrl'>
export type ISODateString = Brand<string, 'ISODateString'>

// --- Factory functions (boundary converters) ---

export function productSlug(raw: string): ProductSlug {
  return raw as ProductSlug
}
export function categorySlug(raw: string): CategorySlug {
  return raw as CategorySlug
}
export function pageSlug(raw: string): PageSlug {
  return raw as PageSlug
}
export function sku(raw: string): SKU {
  return raw as SKU
}
export function orderNumber(raw: string): OrderNumber {
  return raw as OrderNumber
}
export function email(raw: string): Email {
  return raw as Email
}
export function phone(raw: string): Phone {
  return raw as Phone
}
export function siret(raw: string): SIRET {
  return raw as SIRET
}
export function vatNumber(raw: string): VATNumber {
  return raw as VATNumber
}
export function postalCode(raw: string): PostalCode {
  return raw as PostalCode
}
export function imageUrl(raw: string): ImageUrl {
  return raw as ImageUrl
}
export function isoDateString(raw: string): ISODateString {
  return raw as ISODateString
}
