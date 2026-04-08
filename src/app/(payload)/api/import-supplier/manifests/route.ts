import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { UserRoles } from '@/types/enums/user-role'
import { listSeafileDir } from '@/lib/seafile'

interface ManifestEntry {
  name: string
  size: number
  mtime: number | null
}

interface ListResponse {
  files: ManifestEntry[]
  libraryId: string
  dir: string
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== UserRoles.Admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const libraryId = process.env.SEAFILE_IMPORT_LIBRARY_ID
    if (!libraryId) {
      return NextResponse.json(
        { error: 'SEAFILE_IMPORT_LIBRARY_ID env var is not set' },
        { status: 500 },
      )
    }
    const dir = process.env.SEAFILE_IMPORT_MANIFEST_DIR || '/manifests'

    const entries = await listSeafileDir(libraryId, dir)
    const files: ManifestEntry[] = entries
      .filter((e) => e.type === 'file')
      .filter((e) => /\.(yaml|yml)$/i.test(e.name))
      .map((e) => ({
        name: e.name,
        size: e.size ?? 0,
        mtime: e.mtime ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const body: ListResponse = { files, libraryId, dir }
    return NextResponse.json(body)
  } catch (err) {
    console.error('[import-supplier/manifests] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
