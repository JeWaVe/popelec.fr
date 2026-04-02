import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import http from 'node:http'
import type { SeafileAuthToken, SeafileEncryptedPassword } from '@/types/seafile'
import { seafileAuthToken, seafileEncryptedPassword } from '@/types/seafile'

/** Low-level HTTP request using node:http — bypasses Next.js fetch patching. */
function httpRequest(
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string },
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 500, body: Buffer.concat(chunks).toString('utf8') })
        })
      },
    )
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
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
