import { randomBytes } from 'node:crypto'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { createSeafileUser, deleteSeafileUser, encryptPassword } from '@/lib/seafile'

const isSeafileConfigured = () => Boolean(process.env.SEAFILE_URL && process.env.SEAFILE_ADMIN_TOKEN)

export const afterChangeSeafileSync: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (!isSeafileConfigured()) return doc
  if (operation !== 'create') return doc

  const userEmail = doc.email as string
  const displayName = [doc.firstName, doc.lastName].filter(Boolean).join(' ') || userEmail

  try {
    const plainPassword = randomBytes(24).toString('base64url')
    const seafileEmail = await createSeafileUser(userEmail, plainPassword, displayName)
    if (!seafileEmail) return doc

    const encrypted = encryptPassword(plainPassword)

    await req.payload.db.updateOne({
      collection: 'users',
      id: doc.id as number,
      data: {
        seafileEmail,
        seafilePasswordEncrypted: encrypted as string,
      },
      req,
    })
    req.payload.logger.info(`Seafile: synced ${userEmail} → ${seafileEmail}`)
  } catch (err) {
    req.payload.logger.error(`Seafile user sync failed for ${userEmail}: ${err}`)
  }

  return doc
}

export const afterDeleteSeafileSync: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (!isSeafileConfigured()) return

  const seafileEmail = (doc.seafileEmail as string) || (doc.email as string)
  if (!seafileEmail) return

  try {
    await deleteSeafileUser(seafileEmail)
  } catch (err) {
    req.payload.logger.error(`Seafile user delete failed for ${seafileEmail}: ${err}`)
  }
}
