export const UserRoles = {
  Admin: 'admin',
  Customer: 'customer',
  Professional: 'professional',
} as const

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles]

export const USER_ROLE_VALUES = Object.values(UserRoles) as unknown as readonly UserRole[]
