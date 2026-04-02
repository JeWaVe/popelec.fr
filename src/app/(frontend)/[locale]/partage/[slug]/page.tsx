'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

type SharePageProps = {
  params: Promise<{ slug: string; locale: string }>
}

type AuthResult = {
  url: string
  libraryId: string
  token: string
  folderName: string
}

export default function SharePage({ params }: SharePageProps) {
  const t = useTranslations('share')
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'error' | 'denied' | 'notFound'>('loading')
  const [folderName, setFolderName] = useState('')

  useEffect(() => {
    let cancelled = false

    async function authenticate() {
      const { slug } = await params

      const res = await fetch(`/api/seafile-auth/${encodeURIComponent(slug)}`, {
        credentials: 'include',
      })

      if (cancelled) return

      if (res.status === 401) {
        router.push(`/compte/connexion?redirect=/partage/${slug}`)
        return
      }

      if (res.status === 403 || res.status === 404) {
        setStatus(res.status === 403 ? 'denied' : 'notFound')
        return
      }

      if (!res.ok) {
        setStatus('error')
        return
      }

      const data = (await res.json()) as AuthResult
      setFolderName(data.folderName)
      setStatus('redirecting')

      // Redirect to Seafile library with token
      const seafileUrl = `${data.url}/#/lib/${data.libraryId}/?token=${data.token}`
      window.location.href = seafileUrl
    }

    authenticate().catch(() => {
      if (!cancelled) setStatus('error')
    })

    return () => {
      cancelled = true
    }
  }, [params, router])

  return (
    <div className="max-w-lg mx-auto px-6 py-16 text-center">
      {status === 'loading' && (
        <>
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-neutral-600">{t('loading')}</p>
        </>
      )}

      {status === 'redirecting' && (
        <>
          <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">{folderName}</h1>
          <p className="text-neutral-600">{t('redirecting')}</p>
        </>
      )}

      {status === 'denied' && (
        <>
          <h1 className="text-2xl font-bold mb-4 text-red-600">{t('accessDenied')}</h1>
          <p className="text-neutral-600">{t('accessDeniedDesc')}</p>
        </>
      )}

      {status === 'notFound' && (
        <>
          <h1 className="text-2xl font-bold mb-4">{t('notFound')}</h1>
          <p className="text-neutral-600">{t('notFoundDesc')}</p>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="text-2xl font-bold mb-4 text-red-600">{t('error')}</h1>
          <p className="text-neutral-600 mb-4">{t('errorDesc')}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
          >
            {t('retry')}
          </button>
        </>
      )}
    </div>
  )
}
