import type React from 'react'
import '@payloadcms/next/css'

export const metadata = {
  title: 'popelec.fr Admin',
}

export default function PayloadLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
