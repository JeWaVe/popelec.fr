'use client'

import React, { useEffect, useMemo, useState } from 'react'
import styles from './ScanSupplier.module.css'

interface ImportSession {
  id: number
  libraryId: string
  libraryName: string
  path?: string | null
  status: string
  errorMessage?: string | null
}

interface ImagePathItem {
  path: string
  altFr?: string | null
  altEn?: string | null
}

interface ProductCandidate {
  id: number
  index: number
  status: 'pending' | 'confirmed' | 'skipped' | 'error'
  proposedSku: string
  proposedName: string
  proposedNameEn?: string | null
  proposedShortDescription?: string | null
  proposedShortDescriptionEn?: string | null
  proposedCategorySlug?: string | null
  proposedBrand?: string | null
  proposedSourceCurrency?: 'USD' | 'CNY' | 'EUR' | null
  proposedSourceAmount?: number | null
  proposedSpecsJson?: string | null
  proposedImagePaths?: ImagePathItem[] | null
  errorMessage?: string | null
}

interface SessionPayload {
  session: ImportSession
  candidates: ProductCandidate[]
}

interface WizardProps {
  readonly sessionId: number
  readonly currentIndex: number
  readonly onIndexChange: (i: number) => void
  readonly onClose: () => void
}

interface EditState {
  proposedSku: string
  proposedName: string
  proposedNameEn: string
  proposedShortDescription: string
  proposedShortDescriptionEn: string
  proposedCategorySlug: string
  proposedBrand: string
  proposedSourceCurrency: 'USD' | 'CNY' | 'EUR'
  proposedSourceAmount: string
  proposedSpecsJson: string
  importLocked: boolean
  allowCreateCategories: boolean
  offline: boolean
}

function emptyEdit(): EditState {
  return {
    proposedSku: '',
    proposedName: '',
    proposedNameEn: '',
    proposedShortDescription: '',
    proposedShortDescriptionEn: '',
    proposedCategorySlug: '',
    proposedBrand: '',
    proposedSourceCurrency: 'USD',
    proposedSourceAmount: '',
    proposedSpecsJson: '[]',
    importLocked: false,
    allowCreateCategories: true,
    offline: false,
  }
}

function fromCandidate(c: ProductCandidate): EditState {
  return {
    proposedSku: c.proposedSku,
    proposedName: c.proposedName,
    proposedNameEn: c.proposedNameEn ?? c.proposedName,
    proposedShortDescription: c.proposedShortDescription ?? '',
    proposedShortDescriptionEn:
      c.proposedShortDescriptionEn ?? c.proposedShortDescription ?? '',
    proposedCategorySlug: c.proposedCategorySlug ?? '',
    proposedBrand: c.proposedBrand ?? '',
    proposedSourceCurrency: (c.proposedSourceCurrency ?? 'USD') as 'USD' | 'CNY' | 'EUR',
    proposedSourceAmount:
      typeof c.proposedSourceAmount === 'number' ? String(c.proposedSourceAmount) : '',
    proposedSpecsJson: c.proposedSpecsJson ?? '[]',
    importLocked: false,
    allowCreateCategories: true,
    offline: false,
  }
}

export default function Wizard(props: WizardProps): React.JSX.Element {
  const [data, setData] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'loaded'; payload: SessionPayload }
  >({ kind: 'loading' })

  const [edit, setEdit] = useState<EditState>(emptyEdit())
  const [busy, setBusy] = useState<boolean>(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState<number>(0)

  // Load session + candidates
  useEffect(() => {
    let cancelled = false
    async function load() {
      setData({ kind: 'loading' })
      try {
        const r = await fetch(`/api/scan-supplier/sessions/${props.sessionId}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        const body = (await r.json()) as { session?: ImportSession; candidates?: ProductCandidate[]; error?: string }
        if (cancelled) return
        if (!r.ok || !body.session || !body.candidates) {
          setData({ kind: 'error', message: body.error ?? `HTTP ${r.status}` })
          return
        }
        setData({
          kind: 'loaded',
          payload: { session: body.session, candidates: body.candidates },
        })
      } catch (err) {
        if (cancelled) return
        setData({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Erreur réseau',
        })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [props.sessionId, reloadKey])

  const candidate = useMemo(() => {
    if (data.kind !== 'loaded') return null
    return data.payload.candidates[props.currentIndex] ?? null
  }, [data, props.currentIndex])

  // Hydrate edit state when the current candidate changes
  useEffect(() => {
    if (candidate) setEdit(fromCandidate(candidate))
    else setEdit(emptyEdit())
    setActionError(null)
  }, [candidate])

  if (data.kind === 'loading') {
    return <p className={styles.muted}>Chargement de la session…</p>
  }
  if (data.kind === 'error') {
    return (
      <div className={styles.error}>
        Impossible de charger la session : {data.message}
        <button type="button" className={styles.linkButton} onClick={props.onClose}>
          Retour
        </button>
      </div>
    )
  }

  const { session, candidates } = data.payload
  const total = candidates.length
  const counts = candidates.reduce(
    (acc, c) => {
      acc[c.status]++
      return acc
    },
    { pending: 0, confirmed: 0, skipped: 0, error: 0 } as Record<
      'pending' | 'confirmed' | 'skipped' | 'error',
      number
    >,
  )

  function nextIndex(from: number): number {
    for (let i = from + 1; i < candidates.length; i++) {
      if (candidates[i].status === 'pending') return i
    }
    // No more pending — fall back to next slot, clamped
    return Math.min(from + 1, candidates.length - 1)
  }

  async function submitConfirm(): Promise<void> {
    if (!candidate) return
    setBusy(true)
    setActionError(null)
    try {
      const r = await fetch(`/api/scan-supplier/candidates/${candidate.id}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedSku: edit.proposedSku,
          proposedName: edit.proposedName,
          proposedNameEn: edit.proposedNameEn,
          proposedShortDescription: edit.proposedShortDescription,
          proposedShortDescriptionEn: edit.proposedShortDescriptionEn,
          proposedCategorySlug: edit.proposedCategorySlug,
          proposedBrand: edit.proposedBrand,
          proposedSourceCurrency: edit.proposedSourceCurrency,
          proposedSourceAmount: Number(edit.proposedSourceAmount),
          proposedSpecsJson: edit.proposedSpecsJson,
          importLocked: edit.importLocked,
          allowCreateCategories: edit.allowCreateCategories,
          offline: edit.offline,
        }),
      })
      const body = (await r.json()) as { ok?: boolean; error?: string }
      if (!r.ok || !body.ok) {
        throw new Error(body.error ?? `HTTP ${r.status}`)
      }
      const next = nextIndex(props.currentIndex)
      props.onIndexChange(next)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setBusy(false)
    }
  }

  async function submitSkip(): Promise<void> {
    if (!candidate) return
    setBusy(true)
    setActionError(null)
    try {
      const r = await fetch(`/api/scan-supplier/candidates/${candidate.id}/skip`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!r.ok) {
        const body = (await r.json()) as { error?: string }
        throw new Error(body.error ?? `HTTP ${r.status}`)
      }
      const next = nextIndex(props.currentIndex)
      props.onIndexChange(next)
      setReloadKey((k) => k + 1)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.wizardWrapper}>
      <header className={styles.wizardHeader}>
        <div>
          <strong>{session.libraryName}</strong>
          <span className={styles.muted}> — {session.path ?? '/'}</span>
        </div>
        <button type="button" className={styles.linkButton} onClick={props.onClose}>
          ← Retour à la liste
        </button>
      </header>

      <div className={styles.progressBar}>
        {props.currentIndex + 1} / {total} — {counts.confirmed} confirmé(s),{' '}
        {counts.skipped} ignoré(s), {counts.pending} en attente, {counts.error} erreur(s)
      </div>

      {!candidate ? (
        <p className={styles.muted}>Aucun candidat à cet index.</p>
      ) : (
        <div className={styles.wizardBody}>
          <div className={styles.candidateMeta}>
            <span className={`${styles.statusBadge} ${styles[`status_${candidate.status}`]}`}>
              {candidate.status}
            </span>
            {candidate.errorMessage && (
              <div className={styles.errorInline}>{candidate.errorMessage}</div>
            )}
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              SKU
              <input
                type="text"
                className={styles.input}
                value={edit.proposedSku}
                onChange={(e) => setEdit({ ...edit, proposedSku: e.target.value })}
                disabled={busy}
              />
            </label>
            <label className={styles.label}>
              Catégorie (slug)
              <input
                type="text"
                className={styles.input}
                value={edit.proposedCategorySlug}
                onChange={(e) =>
                  setEdit({ ...edit, proposedCategorySlug: e.target.value })
                }
                disabled={busy}
              />
            </label>
            <label className={styles.label}>
              Marque
              <input
                type="text"
                className={styles.input}
                value={edit.proposedBrand}
                onChange={(e) => setEdit({ ...edit, proposedBrand: e.target.value })}
                disabled={busy}
              />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              Nom (FR)
              <input
                type="text"
                className={styles.input}
                value={edit.proposedName}
                onChange={(e) => setEdit({ ...edit, proposedName: e.target.value })}
                disabled={busy}
              />
            </label>
            <label className={styles.label}>
              Name (EN)
              <input
                type="text"
                className={styles.input}
                value={edit.proposedNameEn}
                onChange={(e) => setEdit({ ...edit, proposedNameEn: e.target.value })}
                disabled={busy}
              />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              Description courte (FR)
              <textarea
                className={styles.textarea}
                rows={2}
                value={edit.proposedShortDescription}
                onChange={(e) =>
                  setEdit({ ...edit, proposedShortDescription: e.target.value })
                }
                disabled={busy}
              />
            </label>
            <label className={styles.label}>
              Short description (EN)
              <textarea
                className={styles.textarea}
                rows={2}
                value={edit.proposedShortDescriptionEn}
                onChange={(e) =>
                  setEdit({ ...edit, proposedShortDescriptionEn: e.target.value })
                }
                disabled={busy}
              />
            </label>
          </div>

          <div className={styles.row}>
            <label className={styles.label}>
              Devise source
              <select
                className={styles.select}
                value={edit.proposedSourceCurrency}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    proposedSourceCurrency: e.target.value as 'USD' | 'CNY' | 'EUR',
                  })
                }
                disabled={busy}
              >
                <option value="USD">USD ($)</option>
                <option value="CNY">CNY (¥)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </label>
            <label className={styles.label}>
              Montant source
              <input
                type="number"
                step="0.01"
                min="0"
                className={styles.input}
                value={edit.proposedSourceAmount}
                onChange={(e) =>
                  setEdit({ ...edit, proposedSourceAmount: e.target.value })
                }
                disabled={busy}
              />
            </label>
          </div>

          <label className={styles.label}>
            Specs (JSON)
            <textarea
              className={styles.textarea}
              rows={6}
              value={edit.proposedSpecsJson}
              onChange={(e) => setEdit({ ...edit, proposedSpecsJson: e.target.value })}
              disabled={busy}
            />
          </label>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={edit.allowCreateCategories}
                onChange={(e) =>
                  setEdit({ ...edit, allowCreateCategories: e.target.checked })
                }
                disabled={busy}
              />
              Créer la catégorie si manquante
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={edit.offline}
                onChange={(e) => setEdit({ ...edit, offline: e.target.checked })}
                disabled={busy}
              />
              Hors-ligne (FX statiques)
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={edit.importLocked}
                onChange={(e) => setEdit({ ...edit, importLocked: e.target.checked })}
                disabled={busy}
              />
              Verrouiller le produit (ignoré aux ré-imports)
            </label>
          </div>

          {candidate.proposedImagePaths && candidate.proposedImagePaths.length > 0 && (
            <div>
              <h3 className={styles.subTitle}>Images</h3>
              <ul className={styles.imageList}>
                {candidate.proposedImagePaths.map((img, i) => (
                  <li key={i} className={styles.imageItem}>
                    <code>{img.path}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {actionError && <div className={styles.error}>{actionError}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => props.onIndexChange(Math.max(0, props.currentIndex - 1))}
              disabled={busy || props.currentIndex === 0}
            >
              ← Précédent
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={submitSkip}
              disabled={busy}
            >
              Ignorer
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={submitConfirm}
              disabled={busy}
            >
              {busy ? 'Confirmation…' : 'Confirmer'}
            </button>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() =>
                props.onIndexChange(Math.min(total - 1, props.currentIndex + 1))
              }
              disabled={busy || props.currentIndex >= total - 1}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
