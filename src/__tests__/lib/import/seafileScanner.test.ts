import { describe, it, expect } from 'vitest'
import {
  scanLibraryTree,
  classifyFile,
  formatTreeForPrompt,
  extractThumbnailCaptions,
} from '@/lib/import/seafileScanner'
import type { SeafileDirEntry } from '@/lib/seafile'

/** In-memory virtual filesystem for tests. */
function makeLister(tree: Record<string, readonly SeafileDirEntry[]>) {
  let calls = 0
  return {
    list: async (libraryId: string, path: string) => {
      calls++
      void libraryId
      const entries = tree[path]
      if (!entries) throw new Error(`no entries for ${path}`)
      return entries
    },
    get callCount() {
      return calls
    },
  }
}

describe('classifyFile', () => {
  it('classifies images', () => {
    expect(classifyFile('foo.png')).toBe('image')
    expect(classifyFile('foo.JPG')).toBe('image')
    expect(classifyFile('foo.webp')).toBe('image')
  })

  it('classifies pdfs', () => {
    expect(classifyFile('manual.pdf')).toBe('pdf')
    expect(classifyFile('Datasheet.PDF')).toBe('pdf')
  })

  it('classifies spreadsheets', () => {
    expect(classifyFile('prices.xlsx')).toBe('spreadsheet')
    expect(classifyFile('catalog.csv')).toBe('spreadsheet')
  })

  it('falls back to other', () => {
    expect(classifyFile('readme.txt')).toBe('other')
    expect(classifyFile('config.json')).toBe('other')
  })
})

describe('scanLibraryTree', () => {
  it('walks a single-level tree', async () => {
    const lister = makeLister({
      '/': [
        { name: 'a.png', type: 'file', size: 100 },
        { name: 'b.png', type: 'file', size: 200 },
      ],
    })
    const tree = await scanLibraryTree('lib1', '/', {}, lister)
    expect(tree.libraryId).toBe('lib1')
    expect(tree.files).toHaveLength(2)
    expect(tree.files[0].path).toBe('/a.png')
    expect(tree.files[1].path).toBe('/b.png')
    expect(tree.directories).toEqual(['/'])
    expect(tree.truncated).toBe(false)
  })

  it('descends into subdirectories', async () => {
    const lister = makeLister({
      '/': [
        { name: 'top.png', type: 'file', size: 1 },
        { name: 'sub', type: 'dir' },
      ],
      '/sub': [
        { name: 'inner.png', type: 'file', size: 2 },
        { name: 'deep', type: 'dir' },
      ],
      '/sub/deep': [{ name: 'leaf.pdf', type: 'file', size: 3 }],
    })
    const tree = await scanLibraryTree('lib1', '/', { maxDepth: 5 }, lister)
    const paths = tree.files.map((f) => f.path).sort()
    expect(paths).toEqual(['/sub/deep/leaf.pdf', '/sub/inner.png', '/top.png'])
  })

  it('respects maxDepth', async () => {
    const lister = makeLister({
      '/': [{ name: 'a', type: 'dir' }],
      '/a': [{ name: 'b', type: 'dir' }, { name: 'shallow.png', type: 'file', size: 1 }],
      '/a/b': [{ name: 'deep.png', type: 'file', size: 2 }],
    })
    const tree = await scanLibraryTree('lib1', '/', { maxDepth: 1 }, lister)
    const paths = tree.files.map((f) => f.path)
    expect(paths).toContain('/a/shallow.png')
    expect(paths).not.toContain('/a/b/deep.png')
  })

  it('truncates after maxFiles', async () => {
    const entries: SeafileDirEntry[] = []
    for (let i = 0; i < 10; i++) {
      entries.push({ name: `f${i}.png`, type: 'file', size: i })
    }
    const lister = makeLister({ '/': entries })
    const tree = await scanLibraryTree('lib1', '/', { maxFiles: 5 }, lister)
    expect(tree.files).toHaveLength(5)
    expect(tree.truncated).toBe(true)
  })

  it('skips a failing sub-listing without aborting the scan', async () => {
    const lister = {
      list: async (_libId: string, path: string) => {
        if (path === '/') {
          return [
            { name: 'good.png', type: 'file', size: 1 } as SeafileDirEntry,
            { name: 'bad', type: 'dir' } as SeafileDirEntry,
          ]
        }
        if (path === '/bad') throw new Error('forbidden')
        return []
      },
    }
    const tree = await scanLibraryTree('lib1', '/', { maxDepth: 5 }, lister)
    expect(tree.files.map((f) => f.path)).toEqual(['/good.png'])
  })
})

describe('formatTreeForPrompt', () => {
  it('returns a deterministic plain-text listing', async () => {
    const lister = makeLister({
      '/': [
        { name: 'm1.png', type: 'file', size: 100 },
        { name: 'specs.pdf', type: 'file', size: 200 },
      ],
    })
    const tree = await scanLibraryTree('lib1', '/', {}, lister)
    const text = formatTreeForPrompt(tree)
    expect(text).toContain('Library: lib1')
    expect(text).toContain('/m1.png  (100 bytes, image)')
    expect(text).toContain('/specs.pdf  (200 bytes, pdf)')
  })
})

describe('extractThumbnailCaptions', () => {
  it('returns one summary per file with kind', async () => {
    const lister = makeLister({
      '/': [
        { name: 'a.png', type: 'file', size: 1 },
        { name: 'b.txt', type: 'file', size: 2 },
      ],
    })
    const tree = await scanLibraryTree('lib1', '/', {}, lister)
    const summaries = extractThumbnailCaptions(tree)
    expect(summaries).toHaveLength(2)
    expect(summaries[0]).toMatchObject({ name: 'a.png', kind: 'image' })
    expect(summaries[1]).toMatchObject({ name: 'b.txt', kind: 'other' })
  })
})
