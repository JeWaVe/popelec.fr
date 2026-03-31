import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  pathnames: {
    '/': '/',
    '/produits': { fr: '/produits', en: '/products' },
    '/produits/[slug]': { fr: '/produits/[slug]', en: '/products/[slug]' },
    '/categories/[slug]': '/categories/[slug]',
    '/panier': { fr: '/panier', en: '/cart' },
    '/commande': { fr: '/commande', en: '/checkout' },
    '/commande/confirmation': {
      fr: '/commande/confirmation',
      en: '/checkout/confirmation',
    },
    '/devis': { fr: '/devis', en: '/quote' },
    '/compte': { fr: '/compte', en: '/account' },
    '/compte/commandes': { fr: '/compte/commandes', en: '/account/orders' },
    '/compte/devis': { fr: '/compte/devis', en: '/account/quotes' },
    '/mentions-legales': { fr: '/mentions-legales', en: '/legal-notice' },
    '/cgv': { fr: '/cgv', en: '/terms' },
    '/politique-confidentialite': {
      fr: '/politique-confidentialite',
      en: '/privacy-policy',
    },
  },
})
