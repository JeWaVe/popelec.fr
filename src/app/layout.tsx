import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'https://popelec.fr'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
