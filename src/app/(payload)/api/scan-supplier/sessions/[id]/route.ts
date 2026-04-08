import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { UserRoles } from '@/types/enums/user-role'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = rateLimit(getClientIp(req), 'scan-supplier-session-get', {
      limit: 60,
      windowSec: 60,
    })
    if (blocked) return blocked

    const payload = await getPayload()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== UserRoles.Admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const sessionId = Number.parseInt(id, 10)
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 })
    }

    let session
    try {
      session = await payload.findByID({
        collection: 'import-sessions',
        id: sessionId,
      })
    } catch {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    const candidates = await payload.find({
      collection: 'product-candidates',
      where: { session: { equals: sessionId } },
      sort: 'index',
      limit: 1000,
    })

    return NextResponse.json({
      session,
      candidates: candidates.docs,
    })
  } catch (err) {
    console.error('[scan-supplier/sessions/[id] GET] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
