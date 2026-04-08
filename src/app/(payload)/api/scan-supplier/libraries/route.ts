import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { UserRoles } from '@/types/enums/user-role'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { listAllLibraries } from '@/lib/seafile'

export async function GET(req: NextRequest) {
  try {
    const blocked = rateLimit(getClientIp(req), 'scan-supplier-libraries', {
      limit: 30,
      windowSec: 60,
    })
    if (blocked) return blocked

    const payload = await getPayload()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== UserRoles.Admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const libraries = await listAllLibraries()
    return NextResponse.json({ libraries })
  } catch (err) {
    console.error('[scan-supplier/libraries] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
