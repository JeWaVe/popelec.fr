import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock next/server before importing rateLimit
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
    }),
  },
}))

// Dynamic import after mock setup
const { rateLimit, getClientIp } = await import('@/lib/rateLimit')

describe('rateLimit', () => {
  beforeEach(() => {
    // Each test uses a unique prefix to avoid cross-test contamination
  })

  it('allows requests within limit', () => {
    const prefix = `test-${Date.now()}-allow`
    const result = rateLimit('1.2.3.4', prefix, { limit: 5, windowSec: 60 })
    expect(result).toBeNull()
  })

  it('allows multiple requests up to the limit', () => {
    const prefix = `test-${Date.now()}-multi`
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('1.2.3.4', prefix, { limit: 5, windowSec: 60 })).toBeNull()
    }
  })

  it('blocks requests exceeding the limit', () => {
    const prefix = `test-${Date.now()}-block`
    for (let i = 0; i < 3; i++) {
      rateLimit('1.2.3.4', prefix, { limit: 3, windowSec: 60 })
    }
    const blocked = rateLimit('1.2.3.4', prefix, { limit: 3, windowSec: 60 })
    expect(blocked).not.toBeNull()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((blocked as any).status).toBe(429)
  })

  it('tracks different IPs separately', () => {
    const prefix = `test-${Date.now()}-ips`
    for (let i = 0; i < 3; i++) {
      rateLimit('10.0.0.1', prefix, { limit: 3, windowSec: 60 })
    }
    // Different IP should still be allowed
    expect(rateLimit('10.0.0.2', prefix, { limit: 3, windowSec: 60 })).toBeNull()
  })

  it('tracks different prefixes separately', () => {
    const base = `test-${Date.now()}`
    for (let i = 0; i < 3; i++) {
      rateLimit('1.1.1.1', `${base}-a`, { limit: 3, windowSec: 60 })
    }
    // Different prefix should still be allowed
    expect(rateLimit('1.1.1.1', `${base}-b`, { limit: 3, windowSec: 60 })).toBeNull()
  })
})

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })
    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('extracts first IP from comma-separated list', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' },
    })
    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('trims whitespace', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  192.168.1.1  ' },
    })
    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('returns 127.0.0.1 when no forwarded header', () => {
    const request = new Request('http://localhost')
    expect(getClientIp(request)).toBe('127.0.0.1')
  })
})
