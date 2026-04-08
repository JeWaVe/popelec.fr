import { listSeafileDir, type SeafileDirEntry } from '@/lib/seafile'

/**
 * Recursive snapshot of a Seafile library subtree, returned as a flat list
 * of files (directories are descended into but not emitted as entries).
 *
 * Used by the interactive scan-supplier wizard: the LLM extractor reads
 * the listing and proposes a list of product candidates from the file tree.
 */

export interface ScannedFile {
  /** Path inside the library, always starting with `/`. */
  readonly path: string
  /** Just the filename (basename of `path`). */
  readonly name: string
  readonly sizeBytes: number
  readonly mtime: number | null
}

export interface ScannedTree {
  readonly libraryId: string
  readonly rootPath: string
  readonly files: readonly ScannedFile[]
  readonly directories: readonly string[]
  readonly truncated: boolean
}

export interface ScanOptions {
  /** Maximum directory depth to descend (root=0). Default 5. */
  readonly maxDepth?: number
  /** Maximum number of files to collect before truncating. Default 500. */
  readonly maxFiles?: number
}

interface ScanLister {
  list(libraryId: string, path: string): Promise<readonly SeafileDirEntry[]>
}

const DEFAULT_LISTER: ScanLister = {
  list: (libraryId, path) => listSeafileDir(libraryId, path),
}

function joinSeafilePath(parent: string, child: string): string {
  if (parent === '/' || parent === '') return `/${child}`
  return `${parent.replace(/\/$/, '')}/${child}`
}

/**
 * Walks a Seafile library subtree breadth-first up to `maxDepth`, returning
 * a flat list of files and the directories visited.
 */
export async function scanLibraryTree(
  libraryId: string,
  rootPath: string = '/',
  opts: ScanOptions = {},
  lister: ScanLister = DEFAULT_LISTER,
): Promise<ScannedTree> {
  const maxDepth = opts.maxDepth ?? 5
  const maxFiles = opts.maxFiles ?? 500

  const files: ScannedFile[] = []
  const directories: string[] = []
  let truncated = false

  const queue: Array<{ path: string; depth: number }> = [
    { path: rootPath || '/', depth: 0 },
  ]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    if (current.depth > maxDepth) continue

    let entries: readonly SeafileDirEntry[]
    try {
      entries = await lister.list(libraryId, current.path)
    } catch {
      // A failed sub-listing should not abort the whole scan; we just skip.
      continue
    }
    directories.push(current.path)

    for (const entry of entries) {
      const childPath = joinSeafilePath(current.path, entry.name)
      if (entry.type === 'dir') {
        if (current.depth + 1 <= maxDepth) {
          queue.push({ path: childPath, depth: current.depth + 1 })
        }
        continue
      }
      if (files.length >= maxFiles) {
        truncated = true
        continue
      }
      files.push({
        path: childPath,
        name: entry.name,
        sizeBytes: entry.size ?? 0,
        mtime: entry.mtime ?? null,
      })
    }
  }

  return {
    libraryId,
    rootPath: rootPath || '/',
    files,
    directories,
    truncated,
  }
}

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|webp|gif|bmp|tiff)$/i
const PDF_EXT_RE = /\.pdf$/i
const SPREADSHEET_EXT_RE = /\.(xlsx|xls|csv|ods)$/i

export type FileKind = 'image' | 'pdf' | 'spreadsheet' | 'other'

export function classifyFile(name: string): FileKind {
  if (IMAGE_EXT_RE.test(name)) return 'image'
  if (PDF_EXT_RE.test(name)) return 'pdf'
  if (SPREADSHEET_EXT_RE.test(name)) return 'spreadsheet'
  return 'other'
}

/**
 * Build a compact textual representation of the scanned tree to feed to
 * the LLM extractor. We deliberately avoid downloading anything: only
 * filenames + sizes + folder layout are sent, which is enough for the
 * usual supplier-export structure (one product per folder).
 */
export interface ScannedFileSummary {
  readonly path: string
  readonly name: string
  readonly kind: FileKind
  readonly sizeBytes: number
}

export function extractThumbnailCaptions(tree: ScannedTree): readonly ScannedFileSummary[] {
  return tree.files.map((f) => ({
    path: f.path,
    name: f.name,
    kind: classifyFile(f.name),
    sizeBytes: f.sizeBytes,
  }))
}

/** Format the file list as plain text for an LLM prompt. */
export function formatTreeForPrompt(tree: ScannedTree): string {
  const lines: string[] = [
    `Library: ${tree.libraryId}`,
    `Root: ${tree.rootPath}`,
    `Files: ${tree.files.length}${tree.truncated ? ' (truncated)' : ''}`,
    '',
    'File listing:',
  ]
  for (const f of tree.files) {
    lines.push(`- ${f.path}  (${f.sizeBytes} bytes, ${classifyFile(f.name)})`)
  }
  return lines.join('\n')
}
