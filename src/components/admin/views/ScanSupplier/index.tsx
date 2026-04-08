import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { UserRoles } from '@/types/enums/user-role'
import ScanSupplierClient from './ScanSupplierClient'
import styles from './ScanSupplier.module.css'

export default async function ScanSupplierView(props: AdminViewServerProps) {
  const { initPageResult, searchParams } = props
  const user = initPageResult.req.user

  if (!user) {
    redirect('/admin/login')
  }
  if (user.role !== UserRoles.Admin) {
    return (
      <div className={styles.wrapper}>
        <h1 className={styles.title}>Scanner un fournisseur</h1>
        <p className={styles.error}>Accès réservé aux administrateurs.</p>
      </div>
    )
  }

  const seafileConfigured = Boolean(process.env.SEAFILE_URL && process.env.SEAFILE_ADMIN_TOKEN)
  const sessionParam = typeof searchParams?.session === 'string' ? searchParams.session : null
  const indexParam = typeof searchParams?.i === 'string' ? searchParams.i : null

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Scanner un fournisseur</h1>
      <p className={styles.subtitle}>
        Choisis une bibliothèque Seafile, lance un scan LLM, puis valide les produits un par un.
      </p>

      {!seafileConfigured ? (
        <div className={styles.error}>
          Seafile n&apos;est pas configuré (variables d&apos;environnement{' '}
          <code>SEAFILE_URL</code> / <code>SEAFILE_ADMIN_TOKEN</code> manquantes).
        </div>
      ) : (
        <ScanSupplierClient
          initialSessionId={sessionParam}
          initialIndex={indexParam}
        />
      )}
    </div>
  )
}
