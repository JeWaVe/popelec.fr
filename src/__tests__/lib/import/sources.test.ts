import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalFileSource, fileSourceFromConfig, pathBasename } from '@/lib/import/sources'

const FIXTURE_DIR = fileURLToPath(
  new URL('../../fixtures/import/sample-source/', import.meta.url),
)

describe('LocalFileSource', () => {
  const src = new LocalFileSource(FIXTURE_DIR)

  it('reads a file at the root', async () => {
    const buf = await src.read('hello.txt')
    expect(buf.toString('utf8').trim()).toBe('hello world')
  })

  it('reads a nested file', async () => {
    const buf = await src.read(join('sub', 'nested.txt'))
    expect(buf.toString('utf8').trim()).toBe('nested')
  })

  it('lists files at the root', async () => {
    const entries = await src.list('.')
    expect(entries).toContain('hello.txt')
    expect(entries).toContain('sub')
  })

  it('stats an existing file', async () => {
    const s = await src.stat('hello.txt')
    expect(s.exists).toBe(true)
    expect(s.sizeBytes).toBeGreaterThan(0)
  })

  it('stats a missing file without throwing', async () => {
    const s = await src.stat('nope.txt')
    expect(s.exists).toBe(false)
    expect(s.sizeBytes).toBe(0)
  })

  it('rejects absolute paths', async () => {
    await expect(src.read('/etc/passwd')).rejects.toThrow(/absolute path/)
  })

  it('rejects parent traversal', async () => {
    await expect(src.read('../../../etc/passwd')).rejects.toThrow(/escapes base directory/)
  })

  it('describes itself', () => {
    expect(src.describe()).toMatch(/^local:/)
  })
})

describe('fileSourceFromConfig', () => {
  it('builds a LocalFileSource from local config', () => {
    const src = fileSourceFromConfig({ kind: 'local', baseDir: FIXTURE_DIR })
    expect(src).toBeInstanceOf(LocalFileSource)
  })

  it('builds a SeafileFileSource from seafile config', () => {
    const src = fileSourceFromConfig({ kind: 'seafile', libraryId: 'abc-123' })
    expect(src.describe()).toBe('seafile:abc-123')
  })
})

describe('pathBasename', () => {
  it('handles forward slashes', () => {
    expect(pathBasename('a/b/c.png')).toBe('c.png')
  })

  it('handles backslashes', () => {
    expect(pathBasename('a\\b\\c.png')).toBe('c.png')
  })

  it('handles a bare filename', () => {
    expect(pathBasename('hello.txt')).toBe('hello.txt')
  })
})
