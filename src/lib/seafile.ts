import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import type { SeafileAuthToken, SeafileEncryptedPassword } from '@/types/seafile'
import { seafileAuthToken, seafileEncryptedPassword } from '@/types/seafile'

interface SeafileHttpResponse {
  status: number
  body: Buffer
  headers: Record<string, string | string[] | undefined>
}

/**
 * Low-level HTTP request that picks `node:http` or `node:https` based on URL
 * scheme. Returns the body as a Buffer so callers handling binary downloads
 * don't suffer from utf-8 corruption.
 */
function seafileHttpRequest(
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string },
): Promise<SeafileHttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const lib = isHttps ? https : http
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            body: Buffer.concat(chunks),
            headers: res.headers,
          })
        })
      },
    )
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

/**
 * Backwards-compatible wrapper that returns the body as a utf-8 string. Used
 * by JSON / form callers below.
 */
function httpRequest(
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ status: number; body: string }> {
  return seafileHttpRequest(url, options).then((res) => ({
    status: res.status,
    body: res.body.toString('utf8'),
  }))
}

function getEncryptionKey(): Buffer {
  const key = process.env.SEAFILE_ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('SEAFILE_ENCRYPTION_KEY must be at least 32 characters')
  }
  return Buffer.from(key.slice(0, 32), 'utf8')
}

function isSeafileConfigured(): boolean {
  return Boolean(process.env.SEAFILE_URL && process.env.SEAFILE_ADMIN_TOKEN)
}

/** Make an authenticated request to Seafile's admin API (JSON body). */
async function seafileAdminJSON(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: string }> {
  const seafileUrl = process.env.SEAFILE_URL
  const adminToken = process.env.SEAFILE_ADMIN_TOKEN
  if (!seafileUrl || !adminToken) {
    throw new Error('Seafile is not configured (SEAFILE_URL / SEAFILE_ADMIN_TOKEN missing)')
  }

  const headers: Record<string, string> = {
    Authorization: `Token ${adminToken}`,
    Accept: 'application/json',
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await httpRequest(`${seafileUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status >= 400) {
    throw new Error(`Seafile API ${method} ${path} failed (${res.status}): ${res.body.slice(0, 200)}`)
  }
  return res
}

/** Make an authenticated request to Seafile's api2 (form-encoded body). */
async function seafileApi2(
  method: string,
  path: string,
  formData?: Record<string, string>,
): Promise<{ status: number; body: string }> {
  const seafileUrl = process.env.SEAFILE_URL
  const adminToken = process.env.SEAFILE_ADMIN_TOKEN
  if (!seafileUrl || !adminToken) {
    throw new Error('Seafile is not configured (SEAFILE_URL / SEAFILE_ADMIN_TOKEN missing)')
  }

  const headers: Record<string, string> = {
    Authorization: `Token ${adminToken}`,
    Accept: 'application/json',
  }
  if (formData) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }

  const res = await httpRequest(`${seafileUrl}${path}`, {
    method,
    headers,
    body: formData ? new URLSearchParams(formData).toString() : undefined,
  })

  if (res.status >= 400) {
    throw new Error(`Seafile API ${method} ${path} failed (${res.status}): ${res.body.slice(0, 200)}`)
  }
  return res
}

/** Creates a Seafile account. Returns the Seafile-assigned email (may differ from input). */
export async function createSeafileUser(
  userEmail: string,
  password: string,
  _name: string,
): Promise<string | null> {
  if (!isSeafileConfigured()) return null

  // Seafile api2 uses PUT with form-encoded body
  const res = await seafileApi2('PUT', `/api2/accounts/${encodeURIComponent(userEmail)}/`, {
    password,
  })
  // Seafile may assign a UUID email — parse it from the response
  const data = JSON.parse(res.body) as { email?: string }
  return data.email ?? userEmail
}

export async function deleteSeafileUser(userEmail: string): Promise<void> {
  if (!isSeafileConfigured()) return

  await seafileApi2('DELETE', `/api2/accounts/${encodeURIComponent(userEmail)}/`)
}

export async function generateUserAuthToken(userEmail: string): Promise<SeafileAuthToken> {
  if (!isSeafileConfigured()) {
    throw new Error('Seafile is not configured')
  }

  // Admin API v2.1 uses JSON body with 'email' field
  const res = await seafileAdminJSON('POST', '/api/v2.1/admin/generate-user-auth-token/', {
    email: userEmail,
  })
  const data = JSON.parse(res.body) as { token: string }
  return seafileAuthToken(data.token)
}

// --- Password encryption (AES-256-GCM) ---

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

export function encryptPassword(plain: string): SeafileEncryptedPassword {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Format: base64(iv + authTag + ciphertext)
  const combined = Buffer.concat([iv, authTag, encrypted])
  return seafileEncryptedPassword(combined.toString('base64'))
}

export function decryptPassword(encrypted: SeafileEncryptedPassword): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encrypted as string, 'base64')

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return decipher.update(ciphertext) + decipher.final('utf8')
}

// --- Library file access (used by import script) ---

export interface SeafileDirEntry {
  name: string
  type: 'file' | 'dir'
  size?: number
  mtime?: number
}

function requireSeafileEnv(): { url: string; token: string } {
  const url = process.env.SEAFILE_URL
  const token = process.env.SEAFILE_ADMIN_TOKEN
  if (!url || !token) {
    throw new Error('Seafile is not configured (SEAFILE_URL / SEAFILE_ADMIN_TOKEN missing)')
  }
  return { url, token }
}

export interface SeafileLibrary {
  id: string
  name: string
  owner?: string
  mtime?: number
  size?: number
}

/**
 * List all Seafile libraries (repos) accessible with the admin token.
 *
 * Used by the interactive scan-supplier wizard to let the admin pick any
 * library without prior configuration. Tries the v2.1 admin endpoint first
 * (full visibility), falls back to api2 (token owner's libraries).
 */
export async function listAllLibraries(): Promise<readonly SeafileLibrary[]> {
  const { url, token } = requireSeafileEnv()

  // Try admin endpoint first — returns all repos in the system.
  const adminRes = await seafileHttpRequest(`${url}/api/v2.1/admin/libraries/`, {
    method: 'GET',
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  })

  if (adminRes.status < 400) {
    const parsed = JSON.parse(adminRes.body.toString('utf8')) as
      | { repos?: Array<{ id?: string; repo_id?: string; name?: string; owner_email?: string; owner?: string; mtime?: number; size?: number }> }
      | Array<{ id?: string; repo_id?: string; name?: string; owner_email?: string; owner?: string; mtime?: number; size?: number }>
    const list = Array.isArray(parsed) ? parsed : (parsed.repos ?? [])
    return list
      .map((r) => ({
        id: r.id ?? r.repo_id ?? '',
        name: r.name ?? '',
        owner: r.owner_email ?? r.owner,
        mtime: r.mtime,
        size: r.size,
      }))
      .filter((r) => r.id !== '' && r.name !== '')
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Fallback: api2 lists libraries owned by the token's user.
  const res = await seafileHttpRequest(`${url}/api2/repos/`, {
    method: 'GET',
    headers: {
      Authorization: `Token ${token}`,
      Accept: 'application/json',
    },
  })
  if (res.status >= 400) {
    throw new Error(
      `Seafile listAllLibraries failed (${res.status}): ${res.body.toString('utf8').slice(0, 200)}`,
    )
  }
  const parsed = JSON.parse(res.body.toString('utf8')) as Array<{
    id?: string
    name?: string
    owner?: string
    mtime?: number
    size?: number
  }>
  return parsed
    .map((r) => ({
      id: r.id ?? '',
      name: r.name ?? '',
      owner: r.owner,
      mtime: r.mtime,
      size: r.size,
    }))
    .filter((r) => r.id !== '' && r.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** List directory entries inside a Seafile library. */
export async function listSeafileDir(
  libraryId: string,
  path: string,
): Promise<readonly SeafileDirEntry[]> {
  const { url, token } = requireSeafileEnv()
  const res = await seafileHttpRequest(
    `${url}/api2/repos/${encodeURIComponent(libraryId)}/dir/?p=${encodeURIComponent(path)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
      },
    },
  )
  if (res.status >= 400) {
    throw new Error(
      `Seafile listSeafileDir failed (${res.status}): ${res.body.toString('utf8').slice(0, 200)}`,
    )
  }
  const parsed = JSON.parse(res.body.toString('utf8')) as Array<{
    name: string
    type: string
    size?: number
    mtime?: number
  }>
  return parsed.map((e) => ({
    name: e.name,
    type: e.type === 'dir' ? 'dir' : 'file',
    size: e.size,
    mtime: e.mtime,
  }))
}

/** Get a temporary download URL for a file inside a Seafile library. */
export async function getSeafileDownloadLink(
  libraryId: string,
  path: string,
): Promise<string> {
  const { url, token } = requireSeafileEnv()
  const res = await seafileHttpRequest(
    `${url}/api2/repos/${encodeURIComponent(libraryId)}/file/?p=${encodeURIComponent(path)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
      },
    },
  )
  if (res.status >= 400) {
    throw new Error(
      `Seafile getSeafileDownloadLink failed (${res.status}): ${res.body.toString('utf8').slice(0, 200)}`,
    )
  }
  // The api returns a JSON-encoded URL string
  const text = res.body.toString('utf8').trim()
  return text.startsWith('"') ? (JSON.parse(text) as string) : text
}

/** Download a file from a Seafile library, returning its bytes. */
export async function downloadSeafileFile(
  libraryId: string,
  path: string,
): Promise<Buffer> {
  const downloadUrl = await getSeafileDownloadLink(libraryId, path)
  const res = await seafileHttpRequest(downloadUrl, {
    method: 'GET',
    headers: {},
  })
  if (res.status >= 400) {
    throw new Error(
      `Seafile downloadSeafileFile failed (${res.status}): ${res.body.toString('utf8').slice(0, 200)}`,
    )
  }
  return res.body
}

/** Stat a file in a Seafile library by listing its parent directory. */
export async function statSeafileFile(
  libraryId: string,
  path: string,
): Promise<{ exists: boolean; sizeBytes: number; mtime: Date }> {
  const slash = path.lastIndexOf('/')
  const parent = slash <= 0 ? '/' : path.slice(0, slash)
  const name = path.slice(slash + 1)
  try {
    const entries = await listSeafileDir(libraryId, parent)
    const match = entries.find((e) => e.name === name)
    if (!match) return { exists: false, sizeBytes: 0, mtime: new Date(0) }
    return {
      exists: true,
      sizeBytes: match.size ?? 0,
      mtime: match.mtime ? new Date(match.mtime * 1000) : new Date(0),
    }
  } catch {
    return { exists: false, sizeBytes: 0, mtime: new Date(0) }
  }
}
