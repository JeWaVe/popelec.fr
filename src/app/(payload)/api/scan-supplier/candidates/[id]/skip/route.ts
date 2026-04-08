import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { UserRoles } from '@/types/enums/user-role'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { ProductCandidateStatuses } from '@/collections/ProductCandidates'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = rateLimit(getClientIp(req), 'scan-supplier-skip', {
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
    const candidateId = Number.parseInt(id, 10)
    if (!Number.isFinite(candidateId) || candidateId <= 0) {
      return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
    }

    try {
      await payload.findByID({ collection: 'product-candidates', id: candidateId })
    } catch {
      return NextResponse.json({ error: 'Candidat introuvable' }, { status: 404 })
    }

    await payload.update({
      collection: 'product-candidates',
      id: candidateId,
      data: {
        status: ProductCandidateStatuses.Skipped,
        reviewedAt: new Date().toISOString(),
        reviewedBy: user.id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[scan-supplier/skip] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
