import type { CollectionConfig } from 'payload'
import { UserRoles } from '@/types/enums/user-role'

export const SharedFolders: CollectionConfig = {
  slug: 'shared-folders',
  admin: {
    useAsTitle: 'name',
    group: 'Seafile',
    description: 'Dossiers partagés liés aux bibliothèques Seafile',
  },
  access: {
    read: ({ req: { user } }) => user?.role === UserRoles.Admin,
    create: ({ req: { user } }) => user?.role === UserRoles.Admin,
    update: ({ req: { user } }) => user?.role === UserRoles.Admin,
    delete: ({ req: { user } }) => user?.role === UserRoles.Admin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Nom affiché du dossier partagé',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Identifiant URL (ex: 'nuomake' → /partage/nuomake)",
      },
    },
    {
      name: 'seafileLibraryId',
      type: 'text',
      required: true,
      admin: {
        description: 'UUID de la bibliothèque Seafile',
      },
    },
    {
      name: 'allowedUsers',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        description: 'Utilisateurs autorisés à accéder à ce dossier',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Description interne (non affichée)',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: "Désactiver pour bloquer temporairement l'accès",
      },
    },
  ],
}
