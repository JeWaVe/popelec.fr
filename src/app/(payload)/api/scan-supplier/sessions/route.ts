import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { UserRoles } from '@/types/enums/user-role'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { ImportSessionStatuses } from '@/collections/ImportSessions'

interface CreateBody {
  libraryId?: unknown
  libraryName?: unknown
  path?: unknown
}

export async function POST(req: NextRequest) {
  try {
    const blocked = rateLimit(getClientIp(req), 'scan-supplier-sessions-create', {
      limit: 10,
      windowSec: 60,
    })
    if (blocked) return blocked

    const payload = await getPayload()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== UserRoles.Admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    let raw: CreateBody
    try {
      raw = (await req.json()) as CreateBody
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof raw.libraryId !== 'string' || raw.libraryId.trim() === '') {
      return NextResponse.json({ error: 'libraryId is required' }, { status: 400 })
    }
    if (typeof raw.libraryName !== 'string' || raw.libraryName.trim() === '') {
      return NextResponse.json({ error: 'libraryName is required' }, { status: 400 })
    }
    const path =
      typeof raw.path === 'string' && raw.path.trim() !== '' ? raw.path : '/'

    const created = await payload.create({
      collection: 'import-sessions',
      data: {
        libraryId: raw.libraryId,
        libraryName: raw.libraryName,
        path,
        status: ImportSessionStatuses.Scanning,
        createdBy: user.id,
      },
    })

    return NextResponse.json({ sessionId: created.id })
  } catch (err) {
    console.error('[scan-supplier/sessions POST] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const blocked = rateLimit(getClientIp(req), 'scan-supplier-sessions-list', {
      limit: 30,
      windowSec: 60,
    })
    if (blocked) return blocked

    const payload = await getPayload()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || user.role !== UserRoles.Admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const result = await payload.find({
      collection: 'import-sessions',
      where: {
        status: {
          in: [
            ImportSessionStatuses.Scanning,
            ImportSessionStatuses.Ready,
            ImportSessionStatuses.InReview,
          ],
        },
      },
      sort: '-updatedAt',
      limit: 50,
    })

    return NextResponse.json({ sessions: result.docs })
  } catch (err) {
    console.error('[scan-supplier/sessions GET] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
