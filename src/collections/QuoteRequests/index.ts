import type { CollectionConfig } from 'payload'
import { QuoteRequestStatuses, type QuoteRequestStatus } from '@/types/enums/quote-request-status'
import { UserRoles } from '@/types/enums/user-role'
import { enumToPayloadOptions } from '@/types/payload-options'
import { validateEmail, validatePhone, validateSiret, validateMinLength } from '@/lib/validation'

const QUOTE_REQUEST_STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  [QuoteRequestStatuses.New]: 'Nouveau',
  [QuoteRequestStatuses.Processing]: 'En cours',
  [QuoteRequestStatuses.Sent]: 'Devis envoyé',
  [QuoteRequestStatuses.Accepted]: 'Accepté',
  [QuoteRequestStatuses.Rejected]: 'Refusé',
}

export const QuoteRequests: CollectionConfig = {
  slug: 'quote-requests',
  admin: {
    useAsTitle: 'contactName',
    defaultColumns: ['contactName', 'company', 'email', 'status', 'createdAt'],
    group: 'Commerce',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === UserRoles.Admin) return true
      if (user) return { user: { equals: user.id } }
      return false
    },
    create: () => true,
    update: ({ req: { user } }) => user?.role === UserRoles.Admin,
    delete: ({ req: { user } }) => user?.role === UserRoles.Admin,
  },
  fields: [
    {
      name: 'contactName',
      type: 'text',
      required: true,
      validate: validateMinLength(2),
    },
    {
      name: 'company',
      type: 'text',
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      validate: validateEmail,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      validate: validatePhone,
    },
    {
      name: 'siret',
      type: 'text',
      validate: validateSiret,
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
        },
        {
          name: 'productDescription',
          type: 'text',
          admin: { description: 'Description libre si le produit n\'est pas dans le catalogue' },
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          min: 1,
        },
      ],
    },
    {
      name: 'message',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: QuoteRequestStatuses.New,
      options: enumToPayloadOptions(QUOTE_REQUEST_STATUS_LABELS),
      admin: { position: 'sidebar' },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      admin: { description: 'Notes internes (non visibles par le client)' },
      access: {
        read: ({ req }) => req.user?.role === UserRoles.Admin,
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
    },
  ],
}
