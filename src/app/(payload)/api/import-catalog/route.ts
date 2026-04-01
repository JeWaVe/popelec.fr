import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { importFromExcel } from '@/lib/importCatalog'
import { UserRoles } from '@/types/enums/user-role'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const blocked = rateLimit(getClientIp(req), 'import', { limit: 5, windowSec: 60 })
    if (blocked) return blocked

    const payload = await getPayload()

    // Check admin auth
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== UserRoles.Admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const dryRun = formData.get('dryRun') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Format non supporté. Formats acceptés: .xlsx, .xls, .csv' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await importFromExcel(buffer, payload, dryRun)

    return NextResponse.json({
      success: true,
      dryRun,
      ...result,
    })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
