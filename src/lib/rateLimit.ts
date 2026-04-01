import { NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 60_000)

interface RateLimitOptions {
  /** Maximum requests per window */
  limit: number
  /** Window duration in seconds */
  windowSec: number
}

/**
 * In-memory rate limiter. Returns null if allowed, or a 429 NextResponse if blocked.
 */
export function rateLimit(
  ip: string,
  prefix: string,
  { limit, windowSec }: RateLimitOptions,
): NextResponse | null {
  const key = `${prefix}:${ip}`
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowSec * 1000 })
    return null
  }

  entry.count++

  if (entry.count > limit) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      },
    )
  }

  return null
}

/** Extract client IP from request headers */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return '127.0.0.1'
}
