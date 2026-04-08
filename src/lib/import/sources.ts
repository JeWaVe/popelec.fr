import { readFile, readdir, stat as fsStat } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import {
  downloadSeafileFile,
  listSeafileDir,
  statSeafileFile,
} from '@/lib/seafile'

/**
 * Abstract interface for reading files from an arbitrary backing store.
 *
 * `path` is always interpreted relative to the source's `baseDir` / library
 * root — implementations must reject paths that escape the root.
 */
export interface FileSource {
  read(path: string): Promise<Buffer>
  list(dir: string): Promise<readonly string[]>
  stat(path: string): Promise<{ exists: boolean; sizeBytes: number; mtime: Date }>
  describe(): string
}

/**
 * Reads files from the local filesystem under a base directory.
 * Refuses to leave the base directory.
 */
export class LocalFileSource implements FileSource {
  private readonly baseDir: string

  constructor(baseDir: string) {
    this.baseDir = resolve(baseDir)
  }

  private resolveSafe(rawPath: string): string {
    if (isAbsolute(rawPath)) {
      throw new Error(`LocalFileSource: absolute path not allowed: ${rawPath}`)
    }
    const resolved = resolve(this.baseDir, rawPath)
    const rel = relative(this.baseDir, resolved)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`LocalFileSource: path escapes base directory: ${rawPath}`)
    }
    return resolved
  }

  async read(path: string): Promise<Buffer> {
    return readFile(this.resolveSafe(path))
  }

  async list(dir: string): Promise<readonly string[]> {
    const safe = this.resolveSafe(dir)
    return readdir(safe)
  }

  async stat(path: string): Promise<{ exists: boolean; sizeBytes: number; mtime: Date }> {
    const safe = this.resolveSafe(path)
    try {
      const s = await fsStat(safe)
      return { exists: true, sizeBytes: s.size, mtime: s.mtime }
    } catch {
      return { exists: false, sizeBytes: 0, mtime: new Date(0) }
    }
  }

  describe(): string {
    return `local:${this.baseDir}`
  }
}

/**
 * Reads files from a Seafile library. `libraryId` is the repo UUID; paths are
 * always treated as absolute paths inside that repo.
 */
export class SeafileFileSource implements FileSource {
  private readonly libraryId: string

  constructor(libraryId: string) {
    this.libraryId = libraryId
  }

  private toSeafilePath(rawPath: string): string {
    // Seafile expects paths starting with /
    const cleaned = rawPath.replace(/\\/g, '/').replace(/^\.?\/?/, '')
    return `/${cleaned}`
  }

  async read(path: string): Promise<Buffer> {
    return downloadSeafileFile(this.libraryId, this.toSeafilePath(path))
  }

  async list(dir: string): Promise<readonly string[]> {
    const entries = await listSeafileDir(this.libraryId, this.toSeafilePath(dir || '/'))
    return entries.map((e) => e.name)
  }

  async stat(path: string): Promise<{ exists: boolean; sizeBytes: number; mtime: Date }> {
    return statSeafileFile(this.libraryId, this.toSeafilePath(path))
  }

  describe(): string {
    return `seafile:${this.libraryId}`
  }
}

export type FileSourceConfig =
  | { readonly kind: 'local'; readonly baseDir: string }
  | { readonly kind: 'seafile'; readonly libraryId: string }

export function fileSourceFromConfig(cfg: FileSourceConfig): FileSource {
  switch (cfg.kind) {
    case 'local':
      return new LocalFileSource(cfg.baseDir)
    case 'seafile':
      return new SeafileFileSource(cfg.libraryId)
  }
}

/** Convenience: derive the basename of a path regardless of input separators. */
export function pathBasename(p: string): string {
  return basename(p.replace(/\\/g, '/'))
}

/** Helper to join paths with forward slashes (used for manifest paths). */
export function pathJoin(...parts: string[]): string {
  return join(...parts)
}
