import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies that pull in Next.js internals
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: 'a',
}))

vi.mock('react', () => ({
  useState: vi.fn((init: unknown) => [init, vi.fn()]),
  useEffect: vi.fn(),
  useCallback: vi.fn((fn: unknown) => fn),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Dynamic import after mock setup
const { fetchCurrentUser, postLogout } = await import('@/hooks/useAuth')

describe('fetchCurrentUser', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns user when API responds with user data', async () => {
    const user = { id: 1, email: 'test@example.com', name: 'Test' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user }),
    })

    const result = await fetchCurrentUser()

    expect(result).toEqual(user)
    expect(mockFetch).toHaveBeenCalledWith('/api/users/me', { credentials: 'include' })
  })

  it('returns null when API responds with non-ok status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    })

    const result = await fetchCurrentUser()

    expect(result).toBeNull()
  })

  it('returns null when response has no user field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'not logged in' }),
    })

    const result = await fetchCurrentUser()

    expect(result).toBeNull()
  })

  it('returns null when response body is null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(null),
    })

    const result = await fetchCurrentUser()

    expect(result).toBeNull()
  })
})

describe('postLogout', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('sends POST to /api/users/logout with credentials', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    await postLogout()

    expect(mockFetch).toHaveBeenCalledWith('/api/users/logout', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('propagates fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(postLogout()).rejects.toThrow('Network error')
  })
})
