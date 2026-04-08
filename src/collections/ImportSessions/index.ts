import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { enumToPayloadOptions } from '@/types/payload-options'

export const ImportSessionStatuses = {
  Scanning: 'scanning',
  Ready: 'ready',
  InReview: 'in_review',
  Completed: 'completed',
  Failed: 'failed',
} as const

export type ImportSessionStatus =
  (typeof ImportSessionStatuses)[keyof typeof ImportSessionStatuses]

const STATUS_LABELS: Record<ImportSessionStatus, string> = {
  [ImportSessionStatuses.Scanning]: 'Scan en cours',
  [ImportSessionStatuses.Ready]: 'Prêt',
  [ImportSessionStatuses.InReview]: 'En revue',
  [ImportSessionStatuses.Completed]: 'Terminé',
  [ImportSessionStatuses.Failed]: 'Échoué',
}

export const ImportSessions: CollectionConfig = {
  slug: 'import-sessions',
  admin: {
    useAsTitle: 'libraryName',
    defaultColumns: ['libraryName', 'status', 'scanStartedAt', 'createdBy'],
    group: 'Commerce',
    description: 'Sessions de scan interactif d\u2019une bibliothèque Seafile fournisseur',
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'libraryId',
      type: 'text',
      required: true,
      admin: { description: 'UUID de la bibliothèque Seafile scannée' },
    },
    {
      name: 'libraryName',
      type: 'text',
      required: true,
    },
    {
      name: 'path',
      type: 'text',
      defaultValue: '/',
      admin: { description: 'Sous-dossier scanné dans la bibliothèque' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: ImportSessionStatuses.Scanning,
      options: enumToPayloadOptions(STATUS_LABELS),
      admin: { position: 'sidebar' },
    },
    {
      name: 'scanStartedAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'scanCompletedAt',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'fileTreeJson',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: 'Snapshot JSON brut du listing Seafile (audit)',
      },
    },
    {
      name: 'llmRawResponse',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: 'Réponse brute du LLM Claude (debug)',
      },
    },
    {
      name: 'errorMessage',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
