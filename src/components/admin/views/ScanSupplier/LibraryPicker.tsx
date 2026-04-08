'use client'

import React, { useEffect, useState } from 'react'
import styles from './ScanSupplier.module.css'

interface Library {
  id: string
  name: string
  owner?: string
  mtime?: number
  size?: number
}

interface ImportSession {
  id: number
  libraryId: string
  libraryName: string
  status: string
  scanStartedAt?: string | null
  scanCompletedAt?: string | null
  errorMessage?: string | null
  updatedAt?: string
}

interface LibraryPickerProps {
  readonly onSessionStarted: (id: number) => void
  readonly onSessionResumed: (id: number, currentIndex: number) => void
}

type LoadState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; data: T }

export default function LibraryPicker(props: LibraryPickerProps): React.JSX.Element {
  const [libraries, setLibraries] = useState<LoadState<Library[]>>({ kind: 'loading' })
  const [sessions, setSessions] = useState<LoadState<ImportSession[]>>({ kind: 'loading' })
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('')
  const [pathInput, setPathInput] = useState<string>('/')
  const [starting, setStarting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadLibraries() {
      try {
        const r = await fetch('/api/scan-supplier/libraries', { credentials: 'include' })
        const data = (await r.json()) as { libraries?: Library[]; error?: string }
        if (cancelled) return
        if (!r.ok) {
          setLibraries({ kind: 'error', message: data.error ?? `HTTP ${r.status}` })
          return
        }
        setLibraries({ kind: 'loaded', data: data.libraries ?? [] })
        if (data.libraries && data.libraries.length > 0) {
          setSelectedLibraryId(data.libraries[0].id)
        }
      } catch (err) {
        if (cancelled) return
        setLibraries({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Erreur réseau',
        })
      }
    }

    async function loadSessions() {
      try {
        const r = await fetch('/api/scan-supplier/sessions', { credentials: 'include' })
        const data = (await r.json()) as { sessions?: ImportSession[]; error?: string }
        if (cancelled) return
        if (!r.ok) {
          setSessions({ kind: 'error', message: data.error ?? `HTTP ${r.status}` })
          return
        }
        setSessions({ kind: 'loaded', data: data.sessions ?? [] })
      } catch (err) {
        if (cancelled) return
        setSessions({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Erreur réseau',
        })
      }
    }

    loadLibraries()
    loadSessions()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleStart(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!selectedLibraryId || libraries.kind !== 'loaded') return
    const lib = libraries.data.find((l) => l.id === selectedLibraryId)
    if (!lib) return

    setStarting(true)
    setError(null)
    try {
      const r = await fetch('/api/scan-supplier/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId: lib.id,
          libraryName: lib.name,
          path: pathInput || '/',
        }),
      })
      const data = (await r.json()) as { sessionId?: number; error?: string }
      if (!r.ok || typeof data.sessionId !== 'number') {
        throw new Error(data.error ?? `HTTP ${r.status}`)
      }
      const sessionId = data.sessionId

      // Trigger the scan synchronously
      const scanRes = await fetch(`/api/scan-supplier/sessions/${sessionId}/scan`, {
        method: 'POST',
        credentials: 'include',
      })
      const scanData = (await scanRes.json()) as { ok?: boolean; error?: string }
      if (!scanRes.ok || !scanData.ok) {
        throw new Error(scanData.error ?? `Scan failed: HTTP ${scanRes.status}`)
      }

      props.onSessionStarted(sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className={styles.pickerWrapper}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Lancer un nouveau scan</h2>

        {libraries.kind === 'loading' && (
          <p className={styles.muted}>Chargement des bibliothèques Seafile…</p>
        )}
        {libraries.kind === 'error' && (
          <div className={styles.error}>
            Impossible de lister les bibliothèques : {libraries.message}
          </div>
        )}
        {libraries.kind === 'loaded' && libraries.data.length === 0 && (
          <p className={styles.muted}>Aucune bibliothèque visible avec le token admin.</p>
        )}
        {libraries.kind === 'loaded' && libraries.data.length > 0 && (
          <form className={styles.form} onSubmit={handleStart}>
            <label className={styles.label}>
              Bibliothèque
              <select
                className={styles.select}
                value={selectedLibraryId}
                onChange={(e) => setSelectedLibraryId(e.target.value)}
                disabled={starting}
              >
                {libraries.data.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name}
                    {lib.owner ? ` — ${lib.owner}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.label}>
              Sous-dossier (optionnel)
              <input
                type="text"
                className={styles.input}
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="/"
                disabled={starting}
              />
            </label>

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={starting}>
                {starting ? 'Scan en cours…' : 'Lancer le scan'}
              </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}
          </form>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sessions en cours</h2>
        {sessions.kind === 'loading' && (
          <p className={styles.muted}>Chargement des sessions…</p>
        )}
        {sessions.kind === 'error' && (
          <div className={styles.error}>
            Impossible de lister les sessions : {sessions.message}
          </div>
        )}
        {sessions.kind === 'loaded' && sessions.data.length === 0 && (
          <p className={styles.muted}>Aucune session ouverte.</p>
        )}
        {sessions.kind === 'loaded' && sessions.data.length > 0 && (
          <ul className={styles.sessionList}>
            {sessions.data.map((s) => (
              <li key={s.id} className={styles.sessionItem}>
                <div>
                  <strong>{s.libraryName}</strong>{' '}
                  <span className={styles.statusBadge}>{s.status}</span>
                  {s.errorMessage && (
                    <div className={styles.errorInline}>{s.errorMessage}</div>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => props.onSessionResumed(s.id, 0)}
                >
                  Reprendre →
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
