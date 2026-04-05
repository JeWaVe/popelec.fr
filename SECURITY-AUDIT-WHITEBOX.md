# White-Box Security Audit Report — popelec.fr

**Date**: 2026-04-05
**Auditor**: Claude Opus 4.6 (white-box, full source access)
**Scope**: Full source tree at `/home/regisp/code/popelec.fr`
**Stack**: Next.js 15.4.11 + Payload CMS 3.x + PostgreSQL 16 + Stripe + Seafile

---

## Executive Summary

The popelec.fr codebase demonstrates solid security foundations: Stripe webhook signature verification is properly implemented, access control is defined on security-sensitive Payload collections (Users, Orders, SharedFolders), sensitive fields use field-level access restrictions, the Docker production image runs as a non-root user, and security headers (HSTS, CSP, X-Frame-Options) are configured in `next.config.mjs`.

However, the audit identified several issues requiring attention before production launch. The most critical findings relate to **missing write access controls on five collections/globals** (allowing any anonymous user to create/update/delete products, categories, media, pages, and site configuration via the Payload REST API), a **missing userId in Stripe checkout metadata** (causing every order to be created with an invalid customer reference), and **default dev secrets in the committed docker-compose.yml**.

**Risk rating: HIGH** — the missing access controls on Products, Categories, Media, Pages, and Globals are exploitable by any anonymous attacker through the Payload REST API.

**Totals: 5 Critical, 5 High, 7 Medium, 6 Low, 10 Positive findings**

---

## Findings

### CRITICAL

#### C1. Missing Write Access Controls on Products Collection

**Severity:** CRITICAL
**File:** `src/collections/Products/index.ts:26-28`

The Products collection only defines `read: () => true` access. Payload CMS defaults to allowing all operations (create, update, delete) when access controls are not explicitly defined. Any unauthenticated user can create, modify, or delete products via `/api/products`.

```ts
access: {
  read: () => true,
  // create, update, delete are MISSING — defaults to allow all
},
```

An attacker could change product prices to 0 cents, delete the entire catalog, or inject malicious content.

**Recommendation:** Add explicit access controls:
```ts
access: {
  read: () => true,
  create: ({ req: { user } }) => user?.role === UserRoles.Admin,
  update: ({ req: { user } }) => user?.role === UserRoles.Admin,
  delete: ({ req: { user } }) => user?.role === UserRoles.Admin,
},
```

---

#### C2. Missing Write Access Controls on Categories Collection

**Severity:** CRITICAL
**File:** `src/collections/Categories/index.ts:10-12`

Same issue as C1. Only `read` is defined; create/update/delete default to allowing everyone.

**Recommendation:** Add admin-only create/update/delete access controls.

---

#### C3. Missing Write Access Controls on Media Collection

**Severity:** CRITICAL
**File:** `src/collections/Media/index.ts:17-19`

Any anonymous user can upload files to the media collection via the REST API. This could fill disk space, upload malicious PDFs (the collection accepts `image/*` and `application/pdf`), or replace existing media assets.

**Recommendation:** Add admin-only or authenticated-user-only create/update/delete.

---

#### C4. Missing Write Access Controls on Pages Collection

**Severity:** CRITICAL
**File:** `src/collections/Pages/index.ts:9-11`

Any anonymous user can create, modify, or delete CMS pages (CGV, privacy policy, legal notices) via the REST API.

**Recommendation:** Add admin-only create/update/delete access controls.

---

#### C5. Missing Update Access Controls on Globals (SiteSettings, Navigation)

**Severity:** CRITICAL
**Files:** `src/globals/SiteSettings.ts:9-11`, `src/globals/Navigation.ts:9-11`

Both globals only define `read: () => true`. The `update` access control is not defined, defaulting to allowing anyone. An attacker could modify site settings (company info, shipping costs) or navigation links (redirect users to phishing pages).

```ts
access: {
  read: () => true,
  // update is MISSING
},
```

**Recommendation:** Add `update: ({ req: { user } }) => user?.role === UserRoles.Admin` to both globals.

---

### HIGH

#### H1. Hardcoded Seed Password in Source Code

**Severity:** HIGH
**File:** `src/seed.ts:196,202`

The seed script contains a hardcoded admin password and prints it via `console.log`. The git history may contain the real password if it was previously different.

**Recommendation:** Read the seed password from `process.env.ADMIN_SEED_PASSWORD`, never log passwords, audit git history for any previous real values.

---

#### H2. Default Dev Secrets in Committed docker-compose.yml

**Severity:** HIGH
**File:** `docker-compose.yml:30,46`

The dev docker-compose file contains hardcoded fallback secrets:

```yaml
PAYLOAD_SECRET: dev-secret-do-not-use-in-production
POSTGRES_PASSWORD: payload
SEAFILE_ENCRYPTION_KEY: ${SEAFILE_ENCRYPTION_KEY:-dev_seafile_encryption_key_32chars}
SEAFILE_ADMIN_PASSWORD: ${SEAFILE_ADMIN_PASSWORD:-admin_dev_password}
SEAFILE_MYSQL_ROOT_PASSWORD: ${SEAFILE_MYSQL_ROOT_PASSWORD:-seafile_dev}
```

These create risk if the dev compose file is accidentally used in production.

**Recommendation:** Add a startup check that fails if `PAYLOAD_SECRET` matches the dev default.

---

#### H3. Seafile Auth Token Exposed in URL Fragment

**Severity:** HIGH
**File:** `src/app/(frontend)/[locale]/partage/[slug]/page.tsx:56-57`

The Seafile auth token is placed in the URL fragment:

```ts
const seafileUrl = `${data.url}/#/lib/${data.libraryId}/?token=${data.token}`
window.location.href = seafileUrl
```

URL fragments appear in browser history, may be logged by extensions, and are visible in the address bar.

**Recommendation:** Use a POST-based redirect or short-lived session cookie approach. Ensure tokens have very short expiry.

---

#### H4. Order Number Race Condition

**Severity:** HIGH
**File:** `src/app/(payload)/api/stripe-webhook/route.ts:45-46`

The order number is generated by counting existing orders:

```ts
const orderCount = await payload.count({ collection: 'orders' })
const orderNumber = `POP-${String(orderCount.totalDocs + 1).padStart(6, '0')}`
```

TOCTOU race condition — two simultaneous webhooks may generate the same order number. Since `orderNumber` has `unique: true`, one creation will fail silently.

**Recommendation:** Use `POP-${Date.now()}-${randomBytes(3).toString('hex')}` or a database sequence.

---

#### H5. Missing userId in Checkout Session Metadata

**Severity:** HIGH
**File:** `src/app/(payload)/api/create-checkout-session/route.ts:83-93`

The checkout session is created without the user's ID:

```ts
metadata: {
  source: 'popelec',
  // userId is NOT included
},
```

But the webhook handler tries to extract it:
```ts
const customerId = parseInt(session.metadata?.userId || '0', 10)
```

Every order will have `customer: 0`, an invalid user reference. Orders will be orphaned.

**Recommendation:** Authenticate the user in the checkout endpoint and include `userId` in the metadata. Handle anonymous checkout explicitly.

---

### MEDIUM

#### M1. No Rate Limiting on Stripe Webhook Endpoint

**Severity:** MEDIUM
**File:** `src/app/(payload)/api/stripe-webhook/route.ts`

Signature verification rejects invalid requests, but resource consumption during verification of many invalid requests is still a concern.

**Recommendation:** Restrict to [Stripe IP ranges](https://docs.stripe.com/ips) at the WAF/nginx level.

---

#### M2. No Rate Limiting on Payload REST API

**Severity:** MEDIUM
**File:** `src/app/(payload)/api/[...slug]/route.ts`

The Payload REST API (including `/api/users/login`) has no rate limiting, enabling brute-force login attacks and spam submission of quote requests.

**Recommendation:** Add middleware-level rate limiting, especially for login and create endpoints.

---

#### M3. Seafile Internal Communication Over HTTP

**Severity:** MEDIUM
**File:** `src/lib/seafile.ts:7-33`

All Seafile API calls use `node:http` (plain text). The admin token is sent in the Authorization header over unencrypted connections. Acceptable within Docker network but vulnerable if services are separated.

**Recommendation:** Add HTTPS support for Seafile internal communication as a configuration option.

---

#### M4. CSP Allows `unsafe-inline` and `unsafe-eval` for Scripts

**Severity:** MEDIUM
**File:** `next.config.mjs:26`

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com
```

Both directives significantly weaken CSP XSS protection.

**Recommendation:** Investigate nonce-based CSP with Next.js 15. Remove `'unsafe-eval'` if not strictly required.

---

#### M5. Unlimited File Upload Size for Seafile Proxy

**Severity:** MEDIUM
**File:** `nginx/conf.d/default.conf:96`

```nginx
client_max_body_size 0;
```

Allows unlimited uploads through Seafile proxy, enabling disk-filling DoS.

**Recommendation:** Set a reasonable maximum (e.g., `10G`).

---

#### M6. In-Memory Rate Limiter Does Not Work Across Instances

**Severity:** MEDIUM
**File:** `src/lib/rateLimit.ts:8`

The rate limiter uses an in-process `Map`. With multiple instances, each has its own counter, effectively multiplying the allowed rate.

**Recommendation:** Use Redis-backed rate limiting or nginx-level rate limiting for production.

---

#### M7. Nginx Security Headers Overwritten in Location Blocks

**Severity:** MEDIUM
**File:** `nginx/conf.d/default.conf:39-49`

The `add_header Cache-Control` in `/media/` and `/_next/static/` location blocks replaces all parent-level security headers. This is a known nginx behavior where `add_header` in a location block does not inherit from the server block.

**Recommendation:** Repeat all security headers in each location block, or use the `ngx_headers_more` module.

---

### LOW

#### L1. Maintenance Mode Bypass via Cookie Presence

**Severity:** LOW
**File:** `src/middleware.ts:18-23`

Maintenance mode only checks if a `payload-token` cookie **exists**, not whether it is valid. Setting any value for this cookie bypasses maintenance mode.

**Recommendation:** Validate the token or at minimum check it has JWT format.

---

#### L2. SheetJS (xlsx) Library — Known Vulnerabilities

**Severity:** LOW
**File:** `package.json:37`

`xlsx` version ^0.18.5 has known prototype pollution and ReDoS vulnerabilities with **no fix available**. The import endpoint is admin-only, mitigating risk.

**Recommendation:** Consider replacing with a maintained alternative (e.g., `exceljs`).

---

#### L3. Error Messages May Leak Internal Details

**Severity:** LOW
**Files:** Multiple API routes

Error handlers return `err.message` to clients, potentially revealing stack traces or database errors.

**Recommendation:** Log full errors server-side; return generic messages to clients.

---

#### L4. Quote Request `create` Access is Fully Open

**Severity:** LOW
**File:** `src/collections/QuoteRequests/index.ts:28`

Combined with no rate limiting (M2), this enables spam submissions.

**Recommendation:** Add CAPTCHA/honeypot and rate limiting.

---

#### L5. User Registration Fully Open + Seafile Account Creation

**Severity:** LOW
**File:** `src/collections/Users/index.ts:30`

Each user registration triggers automatic Seafile account creation. Without rate limiting, an attacker could create many Seafile accounts.

**Recommendation:** Rate limit registration and consider CAPTCHA.

---

#### L6. Payload Secret Fallback to Empty String

**Severity:** LOW
**File:** `payload.config.ts:48`

```ts
secret: process.env.PAYLOAD_SECRET || '',
```

An empty secret makes JWT tokens trivially forgeable.

**Recommendation:** Throw an error if `PAYLOAD_SECRET` is not set or is too short.

---

### DEPENDENCY VULNERABILITIES (npm audit)

**20 vulnerabilities total: 1 low, 17 moderate, 2 high**

| Package | Severity | Issue | Fix Available? |
|---------|----------|-------|----------------|
| `lodash` <=4.17.23 | **HIGH** | Code Injection via `_.template`, Prototype Pollution via `_.unset`/`_.omit` | Yes (`npm audit fix`) |
| `xlsx` * | **HIGH** | Prototype Pollution, ReDoS | **No** — consider replacing with `exceljs` |
| `next` 9.5.0–15.5.13 | Moderate | DoS via Image Optimizer, HTTP request smuggling, unbounded disk cache | Yes (`npm audit fix --force` → 15.5.14) |
| `nodemailer` <8.0.4 | Moderate | SMTP command injection via `envelope.size` | **No** (Payload dependency) |
| `dompurify` <=3.3.1 | Moderate | mutation-XSS, prototype pollution (4 CVEs) | Yes (`npm audit fix`) |
| `ajv` 7.0.0-alpha–8.17.1 | Moderate | ReDoS with `$data` option | **No** (Payload dependency) |
| `file-type` 13.0.0–21.3.0 | Moderate | Infinite loop in ASF parser | **No** (Payload dependency) |
| `esbuild` <=0.24.2 | Moderate | Dev server request forgery | Yes (`npm audit fix`) |

**Recommendation:**
1. Run `npm audit fix` immediately (fixes lodash, dompurify, esbuild)
2. Run `npm audit fix --force` to update Next.js to 15.5.14 (test thoroughly)
3. Replace `xlsx` with `exceljs` — no fix forthcoming
4. Monitor Payload CMS releases for nodemailer/ajv/file-type fixes

---

### POSITIVE FINDINGS (What's Done Right)

| # | Finding |
|---|---------|
| I1 | Dev secrets in docker-compose.yml clearly labeled "do-not-use-in-production" |
| I2 | Production docker-compose.prod.yml uses `${VARIABLE}` references without hardcoded defaults |
| I3 | **Zero** uses of `dangerouslySetInnerHTML`, `eval()`, or `innerHTML` in source |
| I4 | Stripe webhook signature verification correctly implemented with idempotency check |
| I5 | Seafile encrypted password field: `hidden: true`, `read: () => false`, `update: () => false`, AES-256-GCM with random IVs |
| I6 | Docker production image runs as non-root user (`nextjs:nodejs`) |
| I7 | `.env` files properly gitignored |
| I8 | `NEXT_PUBLIC_` variables contain only intended-public values (server URL, Stripe publishable key, Seafile public URL) |
| I9 | **Server-side price validation**: checkout fetches prices from DB, not from client-submitted cart |
| I10 | User `role` field has field-level update protection (admin-only) |

---

## Summary Table

| # | Severity | Finding | File |
|---|----------|---------|------|
| C1 | CRITICAL | Missing write access on Products | `src/collections/Products/index.ts` |
| C2 | CRITICAL | Missing write access on Categories | `src/collections/Categories/index.ts` |
| C3 | CRITICAL | Missing write access on Media | `src/collections/Media/index.ts` |
| C4 | CRITICAL | Missing write access on Pages | `src/collections/Pages/index.ts` |
| C5 | CRITICAL | Missing update access on Globals | `src/globals/SiteSettings.ts`, `Navigation.ts` |
| H1 | HIGH | Hardcoded seed password | `src/seed.ts` |
| H2 | HIGH | Default dev secrets in docker-compose.yml | `docker-compose.yml` |
| H3 | HIGH | Seafile token in URL fragment | `src/app/(frontend)/[locale]/partage/[slug]/page.tsx` |
| H4 | HIGH | Order number race condition | `src/app/(payload)/api/stripe-webhook/route.ts` |
| H5 | HIGH | Missing userId in checkout metadata | `src/app/(payload)/api/create-checkout-session/route.ts` |
| M1 | MEDIUM | No rate limit on webhook endpoint | `src/app/(payload)/api/stripe-webhook/route.ts` |
| M2 | MEDIUM | No rate limit on Payload REST API | `src/app/(payload)/api/[...slug]/route.ts` |
| M3 | MEDIUM | Seafile internal comms over HTTP | `src/lib/seafile.ts` |
| M4 | MEDIUM | CSP allows unsafe-inline/unsafe-eval | `next.config.mjs` |
| M5 | MEDIUM | Unlimited upload size on Seafile proxy | `nginx/conf.d/default.conf` |
| M6 | MEDIUM | In-memory rate limiter not shared | `src/lib/rateLimit.ts` |
| M7 | MEDIUM | Nginx headers lost in location blocks | `nginx/conf.d/default.conf` |
| L1 | LOW | Maintenance bypass via cookie presence | `src/middleware.ts` |
| L2 | LOW | SheetJS known vulnerabilities (no fix) | `package.json` |
| L3 | LOW | Error messages may leak internals | Multiple API routes |
| L4 | LOW | Quote request creation fully open | `src/collections/QuoteRequests/index.ts` |
| L5 | LOW | User registration open + Seafile | `src/collections/Users/index.ts` |
| L6 | LOW | Payload secret fallback to empty string | `payload.config.ts` |

---

## Priority Remediation Order

1. **Immediate (before any deployment):** Fix C1–C5 — add access controls to Products, Categories, Media, Pages, SiteSettings, and Navigation
2. **Before launch:** Fix H5 (userId in checkout metadata) and H4 (order number race condition) — these will cause broken orders
3. **Before launch:** Fix H1 (seed password), H2 (default secrets), and L6 (empty secret fallback)
4. **Before launch:** Run `npm audit fix` to patch lodash, dompurify, esbuild
5. **Short-term:** Update Next.js to 15.5.14 (`npm audit fix --force`), replace `xlsx` with `exceljs`
6. **Short-term:** Address M2 (rate limiting on REST API), M7 (nginx headers), M4 (CSP)
7. **Ongoing:** Monitor Payload CMS releases for upstream dependency fixes (nodemailer, ajv, file-type)
