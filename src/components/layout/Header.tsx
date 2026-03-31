'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useState } from 'react'

const CATEGORIES = [
  { slug: 'moteurs', key: 'motors' as const },
  { slug: 'variateurs', key: 'inverters' as const },
  { slug: 'disjoncteurs', key: 'breakers' as const },
  { slug: 'armoires', key: 'cabinets' as const },
]

export function Header() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const [mobileOpen, setMobileOpen] = useState(false)

  const catHref = (slug: string) =>
    ({ pathname: '/categories/[slug]' as const, params: { slug } })

  return (
    <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
      {/* Top bar */}
      <div className="bg-primary-500 text-white text-sm py-1.5 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="hidden sm:inline">Électricité Populaire d&apos;Aucamville - Direct usine, qualité contrôlée</span>
          <span className="sm:hidden">popelec.fr</span>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Main nav */}
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-bold text-primary-500">popelec</span>
              <span className="text-xl text-neutral-400">.fr</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <div className="relative group">
              <button className="text-neutral-700 hover:text-primary-500 font-medium transition-colors">
                {t('products')}
              </button>
              <div className="absolute top-full left-0 mt-2 w-56 bg-white shadow-lg rounded-lg border border-neutral-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="py-2">
                  <Link href="/produits" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-primary-50 hover:text-primary-500">
                    {t('products')}
                  </Link>
                  {CATEGORIES.map((cat) => (
                    <Link key={cat.slug} href={catHref(cat.slug)} className="block px-4 py-2 text-sm text-neutral-700 hover:bg-primary-50 hover:text-primary-500">
                      {t(cat.key)}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/devis" className="text-neutral-700 hover:text-primary-500 font-medium transition-colors">
              {t('quote')}
            </Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <Link href="/compte" className="hidden md:flex text-neutral-600 hover:text-primary-500 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
            <Link href="/panier" className="relative text-neutral-600 hover:text-primary-500 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
            </Link>

            {/* Mobile menu button */}
            <button className="md:hidden text-neutral-600" onClick={() => setMobileOpen(!mobileOpen)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-neutral-200 pt-4">
            <div className="flex flex-col gap-3">
              <Link href="/produits" className="text-neutral-700 hover:text-primary-500 font-medium" onClick={() => setMobileOpen(false)}>
                {t('products')}
              </Link>
              {CATEGORIES.map((cat) => (
                <Link key={cat.slug} href={catHref(cat.slug)} className="text-neutral-600 text-sm pl-4" onClick={() => setMobileOpen(false)}>
                  {t(cat.key)}
                </Link>
              ))}
              <Link href="/devis" className="text-neutral-700 hover:text-primary-500 font-medium" onClick={() => setMobileOpen(false)}>
                {t('quote')}
              </Link>
              <Link href="/compte" className="text-neutral-700 hover:text-primary-500 font-medium" onClick={() => setMobileOpen(false)}>
                {t('account')}
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
