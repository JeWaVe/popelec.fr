import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    group: 'Administration',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return { id: { equals: user.id } }
      return false
    },
    create: () => true,
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return { id: { equals: user.id } }
      return false
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
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
      defaultValue: 'customer',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Client', value: 'customer' },
        { label: 'Professionnel', value: 'professional' },
      ],
      access: {
        update: ({ req }) => req.user?.role === 'admin',
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
      admin: {
        description: 'Numéro SIRET (14 chiffres)',
      },
    },
    {
      name: 'vatNumber',
      type: 'text',
      admin: {
        description: 'N° TVA intracommunautaire',
      },
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'addresses',
      type: 'array',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'address', type: 'text', required: true },
        { name: 'city', type: 'text', required: true },
        { name: 'postalCode', type: 'text', required: true },
        { name: 'country', type: 'text', defaultValue: 'FR' },
        { name: 'isDefault', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
