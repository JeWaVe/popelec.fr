import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { Inter } from 'next/font/google'
import { routing } from '../../../../i18n/routing'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartProvider } from '@/components/cart/CartProvider'
import { CookieBanner } from '@/components/ui/CookieBanner'
import '../../globals.css'

const inter = Inter({ subsets: ['latin'] })

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={`${inter.className} bg-white text-neutral-900`}>
        <NextIntlClientProvider messages={messages}>
          <CartProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
            >
              Skip to content
            </a>
            <Header />
            <main id="main-content" className="min-h-screen">{children}</main>
            <Footer />
            <CookieBanner />
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
