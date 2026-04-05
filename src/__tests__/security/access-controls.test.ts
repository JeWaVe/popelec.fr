import { describe, it, expect } from 'vitest'
import type { Access, FieldAccess } from 'payload'
import { Products } from '@/collections/Products'
import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { Users } from '@/collections/Users'
import { SiteSettings } from '@/globals/SiteSettings'
import { Navigation } from '@/globals/Navigation'

type AccessConfig = {
  read?: Access
  create?: Access
  update?: Access
  delete?: Access
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anonReq = { req: { user: null } } as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminReq = { req: { user: { role: 'admin' } } } as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customerReq = { req: { user: { role: 'customer' } } } as any

function callAccess(fn: Access | FieldAccess | undefined, args: unknown): unknown {
  if (typeof fn !== 'function') return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (fn as (args: any) => unknown)(args)
}

describe('Collection access controls — write operations require admin', () => {
  const publicReadAdminWrite = [
    { name: 'Products', config: Products },
    { name: 'Categories', config: Categories },
    { name: 'Media', config: Media },
    { name: 'Pages', config: Pages },
  ]

  for (const { name, config } of publicReadAdminWrite) {
    describe(name, () => {
      const access = config.access as AccessConfig | undefined

      it('has read access defined', () => {
        expect(access?.read).toBeDefined()
      })

      it('blocks anonymous create', () => {
        expect(access?.create).toBeDefined()
        expect(callAccess(access?.create, anonReq)).toBe(false)
      })

      it('blocks anonymous update', () => {
        expect(access?.update).toBeDefined()
        expect(callAccess(access?.update, anonReq)).toBe(false)
      })

      it('blocks anonymous delete', () => {
        expect(access?.delete).toBeDefined()
        expect(callAccess(access?.delete, anonReq)).toBe(false)
      })

      it('allows admin to create', () => {
        expect(callAccess(access?.create, adminReq)).toBe(true)
      })

      it('allows admin to update', () => {
        expect(callAccess(access?.update, adminReq)).toBe(true)
      })

      it('allows admin to delete', () => {
        expect(callAccess(access?.delete, adminReq)).toBe(true)
      })
    })
  }
})

describe('Global access controls — update requires admin', () => {
  const globals = [
    { name: 'SiteSettings', config: SiteSettings },
    { name: 'Navigation', config: Navigation },
  ]

  for (const { name, config } of globals) {
    describe(name, () => {
      const access = config.access as AccessConfig | undefined

      it('has update access defined', () => {
        expect(access?.update).toBeDefined()
      })

      it('blocks anonymous update', () => {
        expect(callAccess(access?.update, anonReq)).toBe(false)
      })

      it('allows admin update', () => {
        expect(callAccess(access?.update, adminReq)).toBe(true)
      })
    })
  }
})

describe('Users — role field access control (privilege escalation prevention)', () => {
  const roleField = Users.fields.find(
    (f) => 'name' in f && f.name === 'role',
  )
  const roleAccess = roleField && 'access' in roleField ? roleField.access : undefined

  it('has create access defined on role field', () => {
    expect(roleAccess?.create).toBeDefined()
  })

  it('blocks anonymous from setting role on create', () => {
    expect(callAccess(roleAccess?.create, anonReq)).toBe(false)
  })

  it('blocks customer from setting role on create', () => {
    expect(callAccess(roleAccess?.create, customerReq)).toBe(false)
  })

  it('allows admin to set role on create', () => {
    expect(callAccess(roleAccess?.create, adminReq)).toBe(true)
  })

  it('has update access defined on role field', () => {
    expect(roleAccess?.update).toBeDefined()
  })

  it('blocks customer from changing role', () => {
    expect(callAccess(roleAccess?.update, customerReq)).toBe(false)
  })

  it('allows admin to change role', () => {
    expect(callAccess(roleAccess?.update, adminReq)).toBe(true)
  })
})
