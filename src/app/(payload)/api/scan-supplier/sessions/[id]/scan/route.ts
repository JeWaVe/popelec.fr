import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { UserRoles } from '@/types/enums/user-role'
import { rateLimit, getClientIp } from '@/lib/rateLimit'
import { ImportSessionStatuses } from '@/collections/ImportSessions'
import { ProductCandidateStatuses } from '@/collections/ProductCandidates'
import { scanLibraryTree, formatTreeForPrompt } from '@/lib/import/seafileScanner'
import { ClaudeCliExtractor } from '@/lib/import/llmExtractor'
import { ExtractedPayloadValidationError } from '@/lib/import/llmSchema'
import { type ExtractedCandidate } from '@/lib/import/llmSchema'

const SCAN_TIMEOUT_MS = 180_000 // 3 minutes for scan + LLM combined

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Strict rate limit: scanning is expensive (LLM cost + time).
    const blocked = rateLimit(getClientIp(req), 'scan-supplier-scan', {
      limit: 5,
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

    // Mark scan as started
    await payload.update({
      collection: 'import-sessions',
      id: sessionId,
      data: {
        status: ImportSessionStatuses.Scanning,
        scanStartedAt: new Date().toISOString(),
        errorMessage: null,
      },
    })

    try {
      // 1. Walk the Seafile library subtree
      const tree = await scanLibraryTree(session.libraryId, session.path ?? '/', {
        maxDepth: 5,
        maxFiles: 500,
      })

      if (tree.files.length === 0) {
        await payload.update({
          collection: 'import-sessions',
          id: sessionId,
          data: {
            status: ImportSessionStatuses.Failed,
            errorMessage: 'Aucun fichier trouvé dans la bibliothèque',
            scanCompletedAt: new Date().toISOString(),
            fileTreeJson: JSON.stringify(tree),
          },
        })
        return NextResponse.json(
          { error: 'Empty library — nothing to scan' },
          { status: 422 },
        )
      }

      // 2. Capture allowed category slugs to constrain the LLM
      const cats = await payload.find({
        collection: 'categories',
        limit: 1000,
        depth: 0,
      })
      const allowedCategories = cats.docs.map((c) => c.slug).filter(Boolean) as string[]

      // 3. Invoke the Claude CLI extractor (with a hard timeout)
      const extractor = new ClaudeCliExtractor({
        timeoutMs: SCAN_TIMEOUT_MS,
      })

      let candidates: readonly ExtractedCandidate[]
      try {
        candidates = await extractor.extract({
          tree,
          libraryName: session.libraryName,
          allowedCategories,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const issues =
          err instanceof ExtractedPayloadValidationError ? err.issues : undefined
        await payload.update({
          collection: 'import-sessions',
          id: sessionId,
          data: {
            status: ImportSessionStatuses.Failed,
            errorMessage: message,
            scanCompletedAt: new Date().toISOString(),
            fileTreeJson: JSON.stringify(tree),
            llmRawResponse: issues ? JSON.stringify(issues) : null,
          },
        })
        return NextResponse.json(
          { error: `LLM extraction failed: ${message}`, issues },
          { status: 502 },
        )
      }

      // 4. Persist the candidates
      // Wipe pre-existing candidates for this session (re-scan support)
      const existing = await payload.find({
        collection: 'product-candidates',
        where: { session: { equals: sessionId } },
        limit: 1000,
      })
      for (const doc of existing.docs) {
        await payload.delete({ collection: 'product-candidates', id: doc.id })
      }

      let i = 0
      for (const c of candidates) {
        await payload.create({
          collection: 'product-candidates',
          data: {
            session: sessionId,
            index: i,
            status: ProductCandidateStatuses.Pending,
            proposedSku: c.proposedSku,
            proposedName: c.proposedName.fr,
            proposedNameEn: c.proposedName.en,
            proposedShortDescription: c.proposedShortDescription.fr,
            proposedShortDescriptionEn: c.proposedShortDescription.en,
            proposedCategorySlug: c.proposedCategorySlug,
            proposedBrand: c.proposedBrand ?? null,
            proposedSourceCurrency: c.proposedSourceCurrency,
            proposedSourceAmount: c.proposedSourceAmount,
            proposedSpecsJson: JSON.stringify(c.proposedSpecs),
            proposedImagePaths: c.proposedImagePaths.map((img) => ({
              path: img.path,
              altFr: img.alt?.fr ?? null,
              altEn: img.alt?.en ?? null,
            })),
            proposedDatasheetPaths: c.proposedDatasheetPaths.map((d) => ({
              path: d.path,
              titleFr: d.title?.fr ?? null,
              titleEn: d.title?.en ?? null,
            })),
          },
        })
        i++
      }

      // 5. Mark the session ready
      await payload.update({
        collection: 'import-sessions',
        id: sessionId,
        data: {
          status: ImportSessionStatuses.Ready,
          scanCompletedAt: new Date().toISOString(),
          fileTreeJson: JSON.stringify(tree),
          llmRawResponse: JSON.stringify({ candidates }),
        },
      })

      return NextResponse.json({
        ok: true,
        candidateCount: candidates.length,
        fileCount: tree.files.length,
        truncated: tree.truncated,
        promptPreview: formatTreeForPrompt(tree).slice(0, 500),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await payload.update({
        collection: 'import-sessions',
        id: sessionId,
        data: {
          status: ImportSessionStatuses.Failed,
          errorMessage: message,
          scanCompletedAt: new Date().toISOString(),
        },
      })
      return NextResponse.json({ error: message }, { status: 500 })
    }
  } catch (err) {
    console.error('[scan-supplier/scan] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}
