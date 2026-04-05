import type { GlobalConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Paramètres du site',
  admin: {
    group: 'Configuration',
  },
  access: {
    read: () => true,
    update: isAdmin,
  },
  fields: [
    {
      name: 'companyName',
      type: 'text',
      defaultValue: 'Électricité Populaire d\'Aucamville',
    },
    {
      name: 'companyEmail',
      type: 'email',
      defaultValue: 'contact@popelec.fr',
    },
    {
      name: 'companyPhone',
      type: 'text',
    },
    {
      name: 'companyAddress',
      type: 'group',
      fields: [
        { name: 'street', type: 'text' },
        { name: 'city', type: 'text', defaultValue: 'Aucamville' },
        { name: 'postalCode', type: 'text' },
        { name: 'country', type: 'text', defaultValue: 'France' },
      ],
    },
    {
      name: 'siret',
      type: 'text',
    },
    {
      name: 'tvaIntracom',
      type: 'text',
      admin: { description: 'N° TVA intracommunautaire' },
    },
    {
      name: 'shipping',
      type: 'group',
      label: 'Livraison',
      fields: [
        {
          name: 'defaultCost',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Frais de livraison par défaut en centimes' },
        },
        {
          name: 'freeShippingThreshold',
          type: 'number',
          defaultValue: 0,
          admin: { description: 'Montant HT minimum pour livraison gratuite (centimes, 0 = désactivé)' },
        },
      ],
    },
    {
      name: 'social',
      type: 'group',
      label: 'Réseaux sociaux',
      fields: [
        { name: 'facebook', type: 'text' },
        { name: 'linkedin', type: 'text' },
      ],
    },
  ],
}
