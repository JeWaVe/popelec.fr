import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { generateUserAuthToken } from '@/lib/seafile'

type RouteParams = { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const payload = await getPayload()

    const { user } = await payload.auth({ headers: req.headers })
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { slug } = await params

    const folders = await payload.find({
      collection: 'shared-folders',
      where: {
        slug: { equals: slug },
        isActive: { equals: true },
      },
      limit: 1,
    })

    if (folders.docs.length === 0) {
      return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    }

    const folder = folders.docs[0]

    // Check if user is in allowedUsers
    const allowedUsers = folder.allowedUsers as Array<{ id: number } | number> | undefined
    if (!allowedUsers || allowedUsers.length === 0) {
      return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    }

    const userId = user.id
    const isAllowed = allowedUsers.some((u) => {
      const id = typeof u === 'object' && u !== null ? u.id : u
      return id === userId
    })

    if (!isAllowed) {
      return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    }

    const seafileEmail = (user.seafileEmail as string) || (user.email as string)
    const token = await generateUserAuthToken(seafileEmail)

    const seafilePublicUrl = process.env.NEXT_PUBLIC_SEAFILE_URL
    if (!seafilePublicUrl) {
      return NextResponse.json({ error: 'Seafile non configuré' }, { status: 500 })
    }

    return NextResponse.json({
      url: seafilePublicUrl,
      libraryId: folder.seafileLibraryId,
      token: token as string,
      folderName: folder.name,
    })
  } catch (err) {
    console.error('Seafile auth error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
