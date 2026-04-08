import React from 'react'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import { UserRoles } from '@/types/enums/user-role'
import ImportForm from './ImportForm'
import styles from './ImportSupplier.module.css'

export default async function ImportSupplierView(props: AdminViewServerProps) {
  const { initPageResult } = props
  const user = initPageResult.req.user

  if (!user) {
    redirect('/admin/login')
  }
  if (user.role !== UserRoles.Admin) {
    return (
      <div className={styles.wrapper}>
        <h1 className={styles.title}>Importer un fournisseur</h1>
        <p className={styles.error}>Accès réservé aux administrateurs.</p>
      </div>
    )
  }

  const libraryId = process.env.SEAFILE_IMPORT_LIBRARY_ID ?? ''
  const manifestDir = process.env.SEAFILE_IMPORT_MANIFEST_DIR ?? '/manifests'
  const seafileConfigured = libraryId.length > 0

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Importer un fournisseur</h1>
      <p className={styles.subtitle}>
        Importe un catalogue de produits depuis un manifeste YAML stocké dans Seafile.
      </p>

      {!seafileConfigured ? (
        <div className={styles.error}>
          La variable d&apos;environnement <code>SEAFILE_IMPORT_LIBRARY_ID</code> n&apos;est pas
          configurée. Définissez-la dans <code>.env</code> avant d&apos;utiliser cette page.
        </div>
      ) : (
        <>
          <div className={styles.configBox}>
            <div>
              <span className={styles.configLabel}>Bibliothèque Seafile :</span>
              <code className={styles.configValue}>{libraryId}</code>
            </div>
            <div>
              <span className={styles.configLabel}>Dossier des manifestes :</span>
              <code className={styles.configValue}>{manifestDir}</code>
            </div>
          </div>
          <ImportForm />
        </>
      )}
    </div>
  )
}
