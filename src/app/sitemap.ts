import type { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://popelec.fr'

  // Static pages
  const staticPages = [
    '',
    '/produits',
    '/devis',
    '/mentions-legales',
    '/cgv',
    '/politique-confidentialite',
  ]

  const staticEntries: MetadataRoute.Sitemap = ['fr', 'en'].flatMap((locale) =>
    staticPages.map((page) => ({
      url: `${baseUrl}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: page === '' ? 1 : 0.8,
      alternates: {
        languages: {
          fr: `${baseUrl}/fr${page}`,
          en: `${baseUrl}/en${page}`,
        },
      },
    }))
  )

  // Dynamic product pages would be fetched from Payload here
  // when the database is running
  let productEntries: MetadataRoute.Sitemap = []
  try {
    const { getPayload } = await import('@/lib/payload')
    const payload = await getPayload()
    const products = await payload.find({
      collection: 'products',
      where: { status: { equals: 'published' } },
      limit: 1000,
      depth: 0,
    })

    productEntries = products.docs.flatMap((product) =>
      ['fr', 'en'].map((locale) => ({
        url: `${baseUrl}/${locale}/produits/${product.slug}`,
        lastModified: new Date(product.updatedAt),
        changeFrequency: 'daily' as const,
        priority: 0.9,
      }))
    )
  } catch {
    // DB not available during build
  }

  return [...staticEntries, ...productEntries]
}
