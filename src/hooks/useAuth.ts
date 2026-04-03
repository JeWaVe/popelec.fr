'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from '@/i18n/navigation'

export type AuthUser = {
  id: number
  email: string
  name?: string
}

type UseAuthResult = {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch('/api/users/me', { credentials: 'include' })
  if (!res.ok) return null
  const data: unknown = await res.json()
  if (data && typeof data === 'object' && 'user' in data) {
    return (data as { user: AuthUser }).user
  }
  return null
}

export async function postLogout(): Promise<void> {
  await fetch('/api/users/logout', {
    method: 'POST',
    credentials: 'include',
  })
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setUser(u))
      .catch(() => {
        // not authenticated
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = useCallback(async () => {
    await postLogout()
    setUser(null)
    router.push('/compte/connexion')
  }, [router])

  return { user, loading, logout }
}
