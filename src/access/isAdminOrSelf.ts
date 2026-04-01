import type { Access } from 'payload'
import { UserRoles } from '@/types/enums/user-role'

export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (user?.role === UserRoles.Admin) return true
  if (user) return { id: { equals: user.id } }
  return false
}
