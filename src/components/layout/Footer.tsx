import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

const catHref = (slug: string) =>
  ({ pathname: '/categories/[slug]' as const, params: { slug } })

export function Footer() {
  const t = useTranslations('footer')
  const tNav = useTranslations('nav')
  const year = new Date().getFullYear()

  return (
    <footer className="bg-neutral-900 text-neutral-300">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">popelec.fr</span>
            </div>
            <p className="text-sm">{t('description')}</p>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('products')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={catHref('moteurs')} className="hover:text-white transition-colors">{tNav('motors')}</Link></li>
              <li><Link href={catHref('variateurs')} className="hover:text-white transition-colors">{tNav('inverters')}</Link></li>
              <li><Link href={catHref('disjoncteurs')} className="hover:text-white transition-colors">{tNav('breakers')}</Link></li>
              <li><Link href={catHref('armoires')} className="hover:text-white transition-colors">{tNav('cabinets')}</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('customerService')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/devis" className="hover:text-white transition-colors">{tNav('quote')}</Link></li>
              <li><Link href="/compte" className="hover:text-white transition-colors">{tNav('account')}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('legal')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/mentions-legales" className="hover:text-white transition-colors">{t('legalNotice')}</Link></li>
              <li><Link href="/cgv" className="hover:text-white transition-colors">{t('terms')}</Link></li>
              <li><Link href="/politique-confidentialite" className="hover:text-white transition-colors">{t('privacy')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-800 mt-8 pt-8 text-sm text-center">
          {t('copyright', { year })}
        </div>
      </div>
    </footer>
  )
}
