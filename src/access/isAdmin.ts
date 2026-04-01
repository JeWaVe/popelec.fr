import type { Access } from 'payload'
import { UserRoles } from '@/types/enums/user-role'

export const isAdmin: Access = ({ req: { user } }) => {
  return user?.role === UserRoles.Admin
}
