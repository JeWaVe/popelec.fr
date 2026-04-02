import type { Brand } from './brand'

export type SeafileLibraryId = Brand<string, 'SeafileLibraryId'>
export type SeafileAuthToken = Brand<string, 'SeafileAuthToken'>
export type SharedFolderSlug = Brand<string, 'SharedFolderSlug'>
export type SeafileEncryptedPassword = Brand<string, 'SeafileEncryptedPassword'>

export function seafileLibraryId(raw: string): SeafileLibraryId {
  return raw as SeafileLibraryId
}
export function seafileAuthToken(raw: string): SeafileAuthToken {
  return raw as SeafileAuthToken
}
export function sharedFolderSlug(raw: string): SharedFolderSlug {
  return raw as SharedFolderSlug
}
export function seafileEncryptedPassword(raw: string): SeafileEncryptedPassword {
  return raw as SeafileEncryptedPassword
}
