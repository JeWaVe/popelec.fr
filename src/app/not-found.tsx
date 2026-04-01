import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export default function RootNotFound() {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-white text-neutral-900`}>
        <div className="max-w-lg mx-auto px-6 py-24 text-center">
          <p className="text-6xl font-bold text-primary-500 mb-4">404</p>
          <h1 className="text-2xl font-bold mb-2">Page introuvable</h1>
          <p className="text-neutral-500 mb-8">
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/fr"
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Retour à l&apos;accueil
            </a>
            <a
              href="/fr/produits"
              className="border border-neutral-300 hover:border-primary-300 text-neutral-700 px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Parcourir le catalogue
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
