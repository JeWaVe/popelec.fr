'use client'

import React, { useEffect, useState } from 'react'
import LibraryPicker from './LibraryPicker'
import Wizard from './Wizard'

interface ScanSupplierClientProps {
  readonly initialSessionId: string | null
  readonly initialIndex: string | null
}

/**
 * Client-side router for the scan-supplier view: shows the library/session
 * picker when no session is selected, otherwise mounts the wizard. Keeps
 * the session id + current index in the URL so refresh resumes.
 */
export default function ScanSupplierClient(
  props: ScanSupplierClientProps,
): React.JSX.Element {
  const [sessionId, setSessionId] = useState<number | null>(
    props.initialSessionId ? Number.parseInt(props.initialSessionId, 10) || null : null,
  )
  const [index, setIndex] = useState<number>(
    props.initialIndex ? Math.max(0, Number.parseInt(props.initialIndex, 10) || 0) : 0,
  )

  // Sync URL when state changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (sessionId === null) {
      url.searchParams.delete('session')
      url.searchParams.delete('i')
    } else {
      url.searchParams.set('session', String(sessionId))
      url.searchParams.set('i', String(index))
    }
    window.history.replaceState(null, '', url.toString())
  }, [sessionId, index])

  if (sessionId === null) {
    return (
      <LibraryPicker
        onSessionStarted={(id) => {
          setSessionId(id)
          setIndex(0)
        }}
        onSessionResumed={(id, resumeIndex) => {
          setSessionId(id)
          setIndex(resumeIndex)
        }}
      />
    )
  }

  return (
    <Wizard
      sessionId={sessionId}
      currentIndex={index}
      onIndexChange={setIndex}
      onClose={() => setSessionId(null)}
    />
  )
}
