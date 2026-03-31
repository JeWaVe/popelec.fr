import type { Access } from 'payload'

export const isLoggedIn: Access = ({ req: { user } }) => {
  return Boolean(user)
}
