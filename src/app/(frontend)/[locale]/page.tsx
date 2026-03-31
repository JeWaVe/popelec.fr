import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return <HomeContent />
}

function HomeContent() {
  const t = useTranslations('home')

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-primary-500 text-white py-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('heroTitle')}
          </h1>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            {t('heroSubtitle')}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href={`/produits`}
              className="bg-accent-500 hover:bg-accent-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              {t('heroCta')}
            </a>
            <a
              href={`/devis`}
              className="border-2 border-white text-white hover:bg-white hover:text-primary-500 px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              {t('heroCtaQuote')}
            </a>
          </div>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="py-16 px-6 bg-neutral-50">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-primary-100 text-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">{t('valueFactory')}</h3>
            <p className="text-neutral-600">{t('valueFactoryDesc')}</p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-primary-100 text-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">{t('valueQuality')}</h3>
            <p className="text-neutral-600">{t('valueQualityDesc')}</p>
          </div>
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-primary-100 text-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold mb-2">{t('valuePro')}</h3>
            <p className="text-neutral-600">{t('valueProDesc')}</p>
          </div>
        </div>
      </section>

      {/* Quote CTA Banner */}
      <section className="bg-neutral-900 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{t('quoteBannerTitle')}</h2>
          <p className="text-neutral-300 mb-8">{t('quoteBannerDesc')}</p>
          <a
            href="/devis"
            className="bg-accent-500 hover:bg-accent-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors inline-block"
          >
            {t('quoteBannerCta')}
          </a>
        </div>
      </section>
    </div>
  )
}
