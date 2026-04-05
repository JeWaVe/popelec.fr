import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from '../i18n/routing'

const intlMiddleware = createMiddleware(routing)

const MAINTENANCE_BYPASS_PATTERNS = [
  /^\/(admin|api|_next|_vercel|media)/,
  /\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?|ttf|eot)$/,
  /\/(fr|en)\/coming-soon$/,
  /\/(fr|en)\/(compte\/(connexion|inscription|mot-de-passe-oublie)|account\/(login|register|forgot-password))$/,
]

export default function middleware(request: NextRequest) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  const { pathname } = request.nextUrl
  // Validate token has JWT-like format (3 base64url segments separated by dots)
  const tokenValue = request.cookies.get('payload-token')?.value
  const hasValidToken = Boolean(tokenValue && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tokenValue))

  if (isMaintenanceMode) {
    const shouldBypass = MAINTENANCE_BYPASS_PATTERNS.some((pattern) => pattern.test(pathname))

    if (!shouldBypass && !hasValidToken) {
      const locale = pathname.startsWith('/en') ? 'en' : 'fr'
      const url = request.nextUrl.clone()
      url.pathname = `/${locale}/coming-soon`
      return NextResponse.redirect(url)
    }
  }

  if (hasValidToken && /\/(fr|en)\/coming-soon$/.test(pathname)) {
    const locale = pathname.startsWith('/en') ? 'en' : 'fr'
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}`
    return NextResponse.redirect(url)
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/', '/(fr|en)/:path*', '/((?!api|admin|_next|_vercel|media|.*\\..*).*)'],
}
