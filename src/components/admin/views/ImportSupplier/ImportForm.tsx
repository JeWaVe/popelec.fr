'use client'

import React, { useEffect, useState } from 'react'
import styles from './ImportSupplier.module.css'

interface ManifestFile {
  name: string
  size: number
  mtime: number | null
}

interface ManifestsResponse {
  files: ManifestFile[]
  libraryId: string
  dir: string
  error?: string
}

interface ImportEntryError {
  sku: string
  message: string
}

interface ImportResultData {
  created: number
  updated: number
  skippedLocked: number
  mediaUploaded: number
  mediaReused: number
  errors: ImportEntryError[]
  fxRates: Record<string, number>
  fxProviderName: string
}

interface CapturedLog {
  level: 'info' | 'warn' | 'error'
  message: string
}

interface RunResponse {
  ok?: boolean
  manifestPath?: string
  productCount?: number
  result?: ImportResultData
  logs?: CapturedLog[]
  error?: string
  issues?: string[]
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatMtime(mtime: number | null): string {
  if (!mtime) return '—'
  return new Date(mtime * 1000).toLocaleString('fr-FR')
}

export default function ImportForm(): React.JSX.Element {
  const [manifestsState, setManifestsState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'loaded'; files: ManifestFile[] }
  >({ kind: 'loading' })

  const [selectedManifest, setSelectedManifest] = useState<string>('')
  const [dryRun, setDryRun] = useState<boolean>(true)
  const [offline, setOffline] = useState<boolean>(false)
  const [allowCreateCategories, setAllowCreateCategories] = useState<boolean>(false)
  const [marginText, setMarginText] = useState<string>('')
  const [landedText, setLandedText] = useState<string>('')

  const [running, setRunning] = useState<boolean>(false)
  const [response, setResponse] = useState<RunResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch('/api/import-supplier/manifests', {
          credentials: 'include',
        })
        const data = (await r.json()) as ManifestsResponse
        if (cancelled) return
        if (!r.ok) {
          setManifestsState({
            kind: 'error',
            message: data.error ?? `HTTP ${r.status}`,
          })
          return
        }
        setManifestsState({ kind: 'loaded', files: data.files })
        if (data.files.length > 0) setSelectedManifest(data.files[0].name)
      } catch (err) {
        if (cancelled) return
        setManifestsState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Erreur réseau',
        })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshManifests(): Promise<void> {
    setManifestsState({ kind: 'loading' })
    setResponse(null)
    try {
      const r = await fetch('/api/import-supplier/manifests', {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = (await r.json()) as ManifestsResponse
      if (!r.ok) {
        setManifestsState({ kind: 'error', message: data.error ?? `HTTP ${r.status}` })
        return
      }
      setManifestsState({ kind: 'loaded', files: data.files })
      if (data.files.length > 0 && !data.files.find((f) => f.name === selectedManifest)) {
        setSelectedManifest(data.files[0].name)
      }
    } catch (err) {
      setManifestsState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erreur réseau',
      })
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!selectedManifest) return
    setRunning(true)
    setResponse(null)

    const margin = marginText.trim() === '' ? undefined : Number(marginText)
    const landed = landedText.trim() === '' ? undefined : Number(landedText)

    try {
      const r = await fetch('/api/import-supplier/run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestName: selectedManifest,
          dryRun,
          offline,
          allowCreateCategories,
          margin,
          landed,
        }),
      })
      const data = (await r.json()) as RunResponse
      setResponse(data)
    } catch (err) {
      setResponse({ error: err instanceof Error ? err.message : 'Erreur réseau' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <fieldset className={styles.fieldset} disabled={running}>
        <legend className={styles.legend}>Manifeste</legend>

        {manifestsState.kind === 'loading' && (
          <p className={styles.muted}>Chargement de la liste des manifestes…</p>
        )}

        {manifestsState.kind === 'error' && (
          <div className={styles.error}>
            Impossible de lister les manifestes : {manifestsState.message}
          </div>
        )}

        {manifestsState.kind === 'loaded' && manifestsState.files.length === 0 && (
          <p className={styles.muted}>
            Aucun fichier <code>.yaml</code> trouvé dans le dossier configuré.
          </p>
        )}

        {manifestsState.kind === 'loaded' && manifestsState.files.length > 0 && (
          <>
            <label className={styles.label}>
              Fichier
              <select
                className={styles.select}
                value={selectedManifest}
                onChange={(e) => setSelectedManifest(e.target.value)}
              >
                {manifestsState.files.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} ({formatBytes(f.size)} — {formatMtime(f.mtime)})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <button
          type="button"
          className={styles.linkButton}
          onClick={refreshManifests}
          disabled={running}
        >
          Rafraîchir la liste
        </button>
      </fieldset>

      <fieldset className={styles.fieldset} disabled={running}>
        <legend className={styles.legend}>Options</legend>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          <span>
            <strong>Dry-run</strong> — n&apos;écrit rien en base, affiche ce qui serait fait.
          </span>
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={offline}
            onChange={(e) => setOffline(e.target.checked)}
          />
          <span>
            <strong>Hors-ligne</strong> — utilise les taux FX de secours statiques au lieu de
            l&apos;API.
          </span>
        </label>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={allowCreateCategories}
            onChange={(e) => setAllowCreateCategories(e.target.checked)}
          />
          <span>
            <strong>Créer les catégories manquantes</strong> — sinon l&apos;import échoue si une
            catégorie n&apos;existe pas.
          </span>
        </label>

        <div className={styles.row}>
          <label className={styles.label}>
            Marge (défaut 2.5)
            <input
              type="number"
              step="0.01"
              min="0"
              className={styles.input}
              value={marginText}
              onChange={(e) => setMarginText(e.target.value)}
              placeholder="2.5"
            />
          </label>
          <label className={styles.label}>
            Frais logistiques (défaut 0.25)
            <input
              type="number"
              step="0.01"
              min="0"
              className={styles.input}
              value={landedText}
              onChange={(e) => setLandedText(e.target.value)}
              placeholder="0.25"
            />
          </label>
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={
            running ||
            !selectedManifest ||
            manifestsState.kind !== 'loaded' ||
            manifestsState.files.length === 0
          }
        >
          {running ? 'Import en cours…' : dryRun ? 'Lancer la simulation' : 'Lancer l\u2019import'}
        </button>
      </div>

      {response && <ResponseBlock response={response} />}
    </form>
  )
}

function ResponseBlock({ response }: { response: RunResponse }): React.JSX.Element {
  if (response.error) {
    return (
      <div className={styles.error}>
        <strong>Erreur :</strong> {response.error}
        {response.issues && response.issues.length > 0 && (
          <ul className={styles.issuesList}>
            {response.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  const r = response.result
  if (!r) {
    return <div className={styles.error}>Réponse inattendue du serveur.</div>
  }

  return (
    <div className={response.ok ? styles.successBox : styles.warningBox}>
      <h3 className={styles.resultTitle}>
        {response.ok ? 'Import terminé' : 'Import terminé avec des erreurs'}
      </h3>
      <p className={styles.muted}>
        Manifeste : <code>{response.manifestPath}</code> — {response.productCount} produit(s)
      </p>

      <table className={styles.summaryTable}>
        <tbody>
          <tr>
            <td>Créés</td>
            <td>{r.created}</td>
          </tr>
          <tr>
            <td>Mis à jour</td>
            <td>{r.updated}</td>
          </tr>
          <tr>
            <td>Verrouillés (ignorés)</td>
            <td>{r.skippedLocked}</td>
          </tr>
          <tr>
            <td>Médias uploadés</td>
            <td>{r.mediaUploaded}</td>
          </tr>
          <tr>
            <td>Médias réutilisés</td>
            <td>{r.mediaReused}</td>
          </tr>
          <tr>
            <td>Erreurs</td>
            <td>{r.errors.length}</td>
          </tr>
          <tr>
            <td>Provider FX</td>
            <td>{r.fxProviderName}</td>
          </tr>
          <tr>
            <td>Taux FX</td>
            <td>
              <code>{JSON.stringify(r.fxRates)}</code>
            </td>
          </tr>
        </tbody>
      </table>

      {r.errors.length > 0 && (
        <>
          <h4 className={styles.errorListTitle}>Erreurs par SKU</h4>
          <ul className={styles.issuesList}>
            {r.errors.map((e) => (
              <li key={e.sku}>
                <code>{e.sku}</code> — {e.message}
              </li>
            ))}
          </ul>
        </>
      )}

      {response.logs && response.logs.length > 0 && (
        <details className={styles.logs}>
          <summary>Logs détaillés ({response.logs.length})</summary>
          <pre>
            {response.logs
              .map((l) => `[${l.level}] ${l.message}`)
              .join('\n')}
          </pre>
        </details>
      )}
    </div>
  )
}
