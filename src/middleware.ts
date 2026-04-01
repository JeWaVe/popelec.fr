import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from '../i18n/routing'

const intlMiddleware = createMiddleware(routing)

const MAINTENANCE_BYPASS_PATTERNS = [
  /^\/(admin|api|_next|_vercel|media)/,
  /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?|ttf|eot)$/,
  /\/(fr|en)\/coming-soon$/,
]

export default function middleware(request: NextRequest) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  if (isMaintenanceMode) {
    const { pathname } = request.nextUrl
    const shouldBypass = MAINTENANCE_BYPASS_PATTERNS.some((pattern) => pattern.test(pathname))

    if (!shouldBypass) {
      const hasToken = request.cookies.has('payload-token')

      if (!hasToken) {
        const locale = pathname.startsWith('/en') ? 'en' : 'fr'
        const url = request.nextUrl.clone()
        url.pathname = `/${locale}/coming-soon`
        return NextResponse.redirect(url)
      }
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/', '/(fr|en)/:path*', '/((?!api|admin|_next|_vercel|media|.*\\..*).*)'],
}
