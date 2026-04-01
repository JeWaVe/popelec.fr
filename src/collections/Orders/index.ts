import type { CollectionConfig } from 'payload'
import { OrderStatuses, type OrderStatus } from '@/types/enums/order-status'
import { UserRoles } from '@/types/enums/user-role'
import { enumToPayloadOptions } from '@/types/payload-options'

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatuses.Pending]: 'En attente de paiement',
  [OrderStatuses.Paid]: 'Payé',
  [OrderStatuses.Processing]: 'En préparation',
  [OrderStatuses.Shipped]: 'Expédié',
  [OrderStatuses.Delivered]: 'Livré',
  [OrderStatuses.Cancelled]: 'Annulé',
  [OrderStatuses.Refunded]: 'Remboursé',
}

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customer', 'totals.totalTTC', 'status', 'createdAt'],
    group: 'Commerce',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === UserRoles.Admin) return true
      if (user) return { customer: { equals: user.id } }
      return false
    },
    create: () => false,
    update: ({ req: { user } }) => user?.role === UserRoles.Admin,
    delete: () => false,
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'items',
      type: 'array',
      required: true,
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'productName', type: 'text', required: true },
        { name: 'sku', type: 'text', required: true },
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'priceHT', type: 'number', required: true },
        { name: 'tvaRate', type: 'text', required: true },
      ],
    },
    {
      name: 'totals',
      type: 'group',
      label: 'Totaux',
      fields: [
        { name: 'subtotalHT', type: 'number', required: true },
        { name: 'tva', type: 'number', required: true },
        { name: 'totalTTC', type: 'number', required: true },
        { name: 'shipping', type: 'number', defaultValue: 0 },
      ],
    },
    {
      name: 'shipping',
      type: 'group',
      label: 'Adresse de livraison',
      fields: [
        { name: 'firstName', type: 'text' },
        { name: 'lastName', type: 'text' },
        { name: 'company', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'postalCode', type: 'text' },
        { name: 'country', type: 'text', defaultValue: 'FR' },
        { name: 'phone', type: 'text' },
      ],
    },
    {
      name: 'billing',
      type: 'group',
      label: 'Adresse de facturation',
      fields: [
        { name: 'firstName', type: 'text' },
        { name: 'lastName', type: 'text' },
        { name: 'company', type: 'text' },
        { name: 'vatNumber', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'postalCode', type: 'text' },
        { name: 'country', type: 'text', defaultValue: 'FR' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: OrderStatuses.Pending,
      options: enumToPayloadOptions(ORDER_STATUS_LABELS),
      admin: { position: 'sidebar' },
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Notes internes sur la commande' },
    },
  ],
}
