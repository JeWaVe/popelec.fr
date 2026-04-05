import type { CollectionConfig } from 'payload'
import { UserRoles, type UserRole } from '@/types/enums/user-role'
import { enumToPayloadOptions } from '@/types/payload-options'
import { validatePhone, validateSiret, validateVATNumber, validatePostalCodeFR } from '@/lib/validation'
import { afterChangeSeafileSync, afterDeleteSeafileSync } from './hooks/syncSeafileUser'

const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRoles.Admin]: 'Admin',
  [UserRoles.Customer]: 'Client',
  [UserRoles.Professional]: 'Professionnel',
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  hooks: {
    afterChange: [afterChangeSeafileSync],
    afterDelete: [afterDeleteSeafileSync],
  },
  admin: {
    useAsTitle: 'email',
    group: 'Administration',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === UserRoles.Admin) return true
      if (user) return { id: { equals: user.id } }
      return false
    },
    create: () => true,
    update: ({ req: { user } }) => {
      if (user?.role === UserRoles.Admin) return true
      if (user) return { id: { equals: user.id } }
      return false
    },
    delete: ({ req: { user } }) => user?.role === UserRoles.Admin,
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
    },
    {
      name: 'lastName',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: UserRoles.Customer,
      options: enumToPayloadOptions(USER_ROLE_LABELS),
      access: {
        create: ({ req }) => req.user?.role === UserRoles.Admin,
        update: ({ req }) => req.user?.role === UserRoles.Admin,
      },
      admin: { position: 'sidebar' },
    },
    {
      name: 'company',
      type: 'text',
    },
    {
      name: 'siret',
      type: 'text',
      validate: validateSiret,
      admin: {
        description: 'Numéro SIRET (14 chiffres)',
      },
    },
    {
      name: 'vatNumber',
      type: 'text',
      validate: validateVATNumber,
      admin: {
        description: 'N° TVA intracommunautaire',
      },
    },
    {
      name: 'phone',
      type: 'text',
      validate: validatePhone,
    },
    {
      name: 'addresses',
      type: 'array',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'address', type: 'text', required: true },
        { name: 'city', type: 'text', required: true },
        { name: 'postalCode', type: 'text', required: true, validate: validatePostalCodeFR },
        { name: 'country', type: 'text', defaultValue: 'FR' },
        { name: 'isDefault', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'seafileEmail',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Compte Seafile associé',
      },
      access: {
        read: ({ req }) => req.user?.role === UserRoles.Admin,
        update: () => false,
      },
    },
    {
      name: 'seafilePasswordEncrypted',
      type: 'text',
      hidden: true,
      access: {
        read: () => false,
        update: () => false,
      },
    },
  ],
}
