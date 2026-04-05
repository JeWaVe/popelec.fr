# Security Code Review -- Senior Security Expert

**Date:** 2026-04-05
**Scope:** Full codebase review of popelec.fr (Next.js 15 + Payload CMS 3.x e-commerce application)
**Reviewer:** Senior Security Expert (automated)

---

## Summary

The codebase demonstrates strong security foundations: well-structured access controls on collections, proper Stripe webhook signature verification, AES-256-GCM encryption for Seafile passwords, non-root Docker production images, comprehensive nginx rate limiting, and a solid Content Security Policy. However, several issues remain that range from a critical privilege escalation path to medium-severity gaps in input validation and configuration hardening.

**Findings by severity:**
- Critical: 1
- High: 3
- Medium: 6
- Low: 5

---

## Critical Issues (must fix before deploy)

### C1. Privilege Escalation via Role Assignment During Registration

**File(s):** `/home/regisp/code/popelec.fr/src/collections/Users/index.ts` (lines 49-55)

**Description:** The `role` field on the Users collection has `access.update` restricted to admins, but there is **no `access.create` restriction**. The collection's top-level `create` access is `() => true` (open registration). This means any anonymous user can register and set their own role to `admin` by including `"role": "admin"` in the POST body to `/api/users`.

Payload CMS field-level access control checks `create` and `update` separately. Since only `update` is defined, the `create` operation falls through to the default (allow).

**Attack scenario:**
```bash
curl -X POST https://popelec.fr/api/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"attacker@evil.com","password":"password123","role":"admin"}'
```
The attacker now has full admin access to the CMS, all orders, all customer data, and can modify products/prices.

**Recommended fix:**
```typescript
// src/collections/Users/index.ts — role field
{
  name: 'role',
  type: 'select',
  defaultValue: UserRoles.Customer,
  options: enumToPayloadOptions(USER_ROLE_LABELS),
  access: {
    create: ({ req }) => req.user?.role === UserRoles.Admin,
    update: ({ req }) => req.user?.role === UserRoles.Admin,
  },
  admin: { position: 'sidebar' },
},
```

---

## High Issues

### H1. `.env` File Committed to Repository With Real Secrets

**File(s):** `/home/regisp/code/popelec.fr/.env` (lines 1-22)

**Description:** The `.env` file contains actual secret values including a Seafile admin token (`f107732ff44713114980e7a81feb57df9cc0d1b2`), an encryption key (`9cfivdQiRjVSAuabziYR7a2LDj2Z6AkW`), and database credentials. While `.env` is listed in `.gitignore`, the file exists on disk and may have been committed in an earlier revision. Additionally, the `.env` currently has a `PAYLOAD_SECRET` value that appears to be a development-only string but could be mistakenly used in production.

**Attack scenario:** If this file was ever committed to git history (even if later removed), anyone with repository access (or if the repo becomes public) gets full access to Seafile admin, can decrypt all stored Seafile passwords, and access the database.

**Recommended fix:**
1. Verify `.env` was never committed: `git log --all --full-history -- .env`
2. If it was committed, rotate ALL secrets immediately (Seafile admin token, encryption key, DB passwords).
3. Consider using `git-secrets` or a pre-commit hook to prevent accidental secret commits.
4. Move the `.env` out of the project directory entirely for production, or use Docker secrets / a vault.

### H2. Checkout Endpoint Lacks Quantity Validation (Negative/Zero/Extreme Values)

**File(s):** `/home/regisp/code/popelec.fr/src/app/(payload)/api/create-checkout-session/route.ts` (lines 25-85)

**Description:** The `create-checkout-session` route accepts `items` with a `quantity` field but never validates that `quantity` is a positive integer. The body is parsed as:
```typescript
const { items } = body as { items: Array<{ productId: string; quantity: number }> }
```
There is no check for `quantity <= 0`, `quantity > MAX_SAFE_VALUE`, non-integer values, or excessively large quantities. While Stripe itself rejects quantities <= 0, a negative quantity could bypass the stock check logic (`stock.quantity < item.quantity` is always true when `item.quantity` is negative), and fractional quantities could produce unexpected pricing.

**Attack scenario:**
- Send `quantity: -1` -- the stock check passes (any stock >= -1), and the behavior at Stripe is undefined/error, but the server-side logic has already been bypassed.
- Send `quantity: 0.5` -- could create a Stripe session with unexpected pricing.
- Send `quantity: 999999999` -- could be used for denial-of-service against Stripe API.

**Recommended fix:**
```typescript
for (const item of items) {
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
    return NextResponse.json(
      { error: 'Quantite invalide' },
      { status: 400 }
    )
  }
  // ... existing product validation
}
```

### H3. Seafile Auth Token Returned Directly to Client Without Expiry or Scoping

**File(s):** `/home/regisp/code/popelec.fr/src/app/(payload)/api/seafile-auth/[slug]/route.ts` (lines 50-62)

**Description:** The `seafile-auth` route generates a Seafile user auth token using the admin API (`generateUserAuthToken`) and returns it directly in the JSON response to the client. The token is then appended to a URL fragment. This token:

1. Is generated via the Seafile admin API, meaning it is a full-privilege token for that user account.
2. Has no explicit expiration or scope limitation documented.
3. Is sent over the wire in a JSON response (visible in browser DevTools, network logs, etc.).
4. Is appended to a URL fragment which, while not sent to servers, is visible in browser history and could be logged by browser extensions.

**Attack scenario:** If the response is intercepted (e.g., by a malicious browser extension, XSS on the Seafile domain, or a man-in-the-middle on the internal network), the attacker gets a long-lived Seafile auth token. The token could be used to access all libraries the user has permissions for, not just the specific shared folder.

**Recommended fix:**
1. Investigate whether Seafile supports short-lived or scoped tokens. If so, use those.
2. Set a short TTL on generated tokens if the Seafile API supports it.
3. Consider a server-side proxy approach where the token never leaves the backend.
4. At minimum, add rate limiting to this endpoint to prevent token-farming attacks.

---

## Medium Issues

### M1. No `X-Frame-Options` Header on Main popelec.fr Server Block

**File(s):** `/home/regisp/code/popelec.fr/nginx/conf.d/default.conf` (lines 34-137), `/home/regisp/code/popelec.fr/next.config.mjs` (lines 22-32)

**Description:** The CSP in `next.config.mjs` does not include a `frame-ancestors` directive. The nginx config for `popelec.fr` does not set `X-Frame-Options`. Only the `files.popelec.fr` vhost has `X-Frame-Options: SAMEORIGIN`. This means the main site can be framed by any domain, enabling clickjacking attacks on the checkout page, login form, or admin panel.

Note: The CSP `frame-src` directive controls what the site can *embed*, not what can embed *the site*. The `frame-ancestors` directive (or `X-Frame-Options`) is needed for the latter.

**Attack scenario:** An attacker creates a malicious page that iframes popelec.fr and overlays invisible elements. A logged-in admin could be tricked into clicking buttons that perform admin actions (changing prices, approving orders, etc.).

**Recommended fix:** Add to the CSP in `next.config.mjs`:
```javascript
"frame-ancestors 'self'",
```
And/or add to the main nginx server block:
```nginx
add_header X-Frame-Options "DENY" always;
```

### M2. Seafile HTTP SSRF via Unvalidated `SEAFILE_URL`

**File(s):** `/home/regisp/code/popelec.fr/src/lib/seafile.ts` (lines 7-33, 47-77)

**Description:** The `httpRequest` function constructs HTTP requests using `process.env.SEAFILE_URL` concatenated with API paths. While this URL is set via environment variables (not user input), the `httpRequest` function uses `node:http` (not HTTPS) and does not validate that the target hostname resolves to an expected internal host. If `SEAFILE_URL` is misconfigured (e.g., pointing to an attacker-controlled server), the admin token would be sent to that server.

More importantly, the function uses raw `http.request` which follows no redirect and has no timeout, making it susceptible to slowloris-style attacks from the Seafile server side.

**Recommended fix:**
1. Add a request timeout to `httpRequest`:
```typescript
req.setTimeout(10000, () => {
  req.destroy(new Error('Seafile request timeout'))
})
```
2. Validate `SEAFILE_URL` starts with expected scheme/host on startup.
3. Consider using HTTPS for internal Seafile communication or at least document the trust boundary.

### M3. No Rate Limiting on User Registration Endpoint

**File(s):** `/home/regisp/code/popelec.fr/nginx/conf.d/default.conf`, `/home/regisp/code/popelec.fr/src/collections/Users/index.ts`

**Description:** The nginx config rate-limits `/api/users/login` and `/api/users/forgot-password`, but `POST /api/users` (user registration) falls under the generic `/api/` rate limit of 30 requests/minute. This is quite generous for registration and could allow:
- Mass account creation for spam/abuse
- Email bombing (if email verification is sent on registration)
- Database pollution

The Seafile user sync hook also fires on every user creation, so mass registration would create Seafile accounts en masse.

**Recommended fix:** Add a dedicated nginx rate limit zone for registration:
```nginx
limit_req_zone $binary_remote_addr zone=register:10m rate=3r/m;

location = /api/users {
    limit_req zone=register burst=2 nodelay;
    limit_req_status 429;
    # ... proxy settings
}
```

### M4. Import Catalog Route Has No File Size Limit

**File(s):** `/home/regisp/code/popelec.fr/src/app/(payload)/api/import-catalog/route.ts` (lines 36-37)

**Description:** The import-catalog route reads an uploaded file entirely into memory with `Buffer.from(await file.arrayBuffer())`. While the route is admin-only and rate-limited, there is no explicit file size check. The nginx `client_max_body_size 50M` provides some protection, but 50MB of Excel data parsed by `xlsx` could consume significant memory and CPU, potentially causing an OOM condition in the Node.js process.

**Attack scenario:** A compromised admin account (or an attacker who exploited C1) uploads a 50MB Excel file with hundreds of thousands of rows, causing the server to hang or crash.

**Recommended fix:**
```typescript
const MAX_IMPORT_SIZE = 5 * 1024 * 1024 // 5MB
if (file.size > MAX_IMPORT_SIZE) {
  return NextResponse.json(
    { error: 'Fichier trop volumineux (max 5 Mo)' },
    { status: 400 }
  )
}
```

### M5. CSP Allows `unsafe-inline` and `unsafe-eval` for Scripts

**File(s):** `/home/regisp/code/popelec.fr/next.config.mjs` (line 26)

**Description:** The Content Security Policy includes `'unsafe-inline' 'unsafe-eval'` in the `script-src` directive. This significantly weakens the CSP and makes XSS exploitation trivial if an injection point is found, as any inline script or `eval()` call would be permitted.

This is a common trade-off with Next.js (which uses inline scripts for hydration), but `unsafe-eval` is typically not required for Next.js in production.

**Attack scenario:** If any XSS vector is found (e.g., through a future code change, a Payload CMS plugin, or a dependency vulnerability), the attacker can execute arbitrary JavaScript because the CSP does not block inline scripts.

**Recommended fix:**
1. Remove `'unsafe-eval'` from `script-src` -- test in production to confirm nothing breaks.
2. For `'unsafe-inline'`, investigate using nonce-based CSP with Next.js (`nonce` support was added in Next.js 13+):
```javascript
"script-src 'self' 'nonce-${nonce}' https://js.stripe.com",
```
At minimum, remove `'unsafe-eval'` which is rarely needed in production Next.js builds.

### M6. Error Messages in Seafile/Stripe API Leak Internal Details in Logs

**File(s):** `/home/regisp/code/popelec.fr/src/lib/seafile.ts` (lines 73-76, 105-107)

**Description:** When Seafile API calls fail, the error includes the response body (up to 200 chars): `Seafile API ${method} ${path} failed (${res.status}): ${res.body.slice(0, 200)}`. This error propagates to the User sync hook which logs it: `Seafile user sync failed for ${userEmail}: ${err}`. The error messages include:
- The Seafile API path (reveals internal architecture)
- The Seafile response body (could contain sensitive data)
- The user's email address

While these only appear in server logs (not in HTTP responses to clients), log files can be compromised or accessed by unauthorized personnel.

**Recommended fix:** Sanitize error messages before logging:
```typescript
req.payload.logger.error(`Seafile user sync failed for user ${doc.id}: ${err instanceof Error ? err.message : 'unknown error'}`)
```
Avoid logging the full Seafile response body; log only the status code.

---

## Low Issues / Suggestions

### L1. `payload-token` Cookie Format Validation in Middleware is Insufficient

**File(s):** `/home/regisp/code/popelec.fr/src/middleware.ts` (lines 19-20)

**Description:** The middleware checks for a JWT-like format with a regex (`/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/`), but this only validates the token *looks like* a JWT. It does not verify the signature. This means in maintenance mode, any string matching this pattern (e.g., `a.b.c`) would bypass the maintenance wall and grant access to all pages.

This is a **defense-in-depth concern** -- the actual authentication still happens server-side via Payload. But the maintenance mode bypass is weaker than intended.

**Attack scenario:** During maintenance mode, an attacker sets a cookie `payload-token=a.b.c` and bypasses the coming-soon redirect to browse the site. They cannot perform authenticated actions, but they can view all pages.

**Recommended fix:** If strict maintenance mode is required, verify the token server-side in middleware. Alternatively, accept this as a known limitation and document it (maintenance mode is a soft gate, not a security boundary).

### L2. In-Memory Rate Limiter Does Not Survive Process Restarts

**File(s):** `/home/regisp/code/popelec.fr/src/lib/rateLimit.ts` (lines 1-57)

**Description:** The rate limiter uses an in-memory `Map`. If the Node.js process restarts (which can happen due to crashes, deployments, or Next.js hot reloading), all rate limit state is lost. In a multi-instance deployment, each instance has its own independent rate limit state.

This is acceptable given that nginx provides the primary rate limiting layer. However, if the app is ever exposed directly (without nginx), this in-memory limiter would be the only protection and it would be easily bypassed by triggering process restarts.

**Recommended fix:** This is a known trade-off. For the current architecture (nginx in front), the in-memory rate limiter serves as defense-in-depth and is acceptable. If scaling to multiple app instances, consider Redis-backed rate limiting.

### L3. Stripe SDK Initialized With Empty String When Key Missing

**File(s):** `/home/regisp/code/popelec.fr/src/lib/stripe.ts` (lines 1-6)

**Description:** `new Stripe(process.env.STRIPE_SECRET_KEY || '', ...)` initializes the Stripe SDK with an empty string if the env var is not set. This means the module loads successfully but all API calls will fail with unhelpful errors. The `create-checkout-session` route does check for the key before proceeding, but other code that imports `stripe` might not.

**Recommended fix:** Either throw at initialization time (like `PAYLOAD_SECRET` does) or add a clear comment that the empty-string fallback is intentional for environments where Stripe is not configured.

### L4. Development Docker Compose Exposes PostgreSQL Port 5432

**File(s):** `/home/regisp/code/popelec.fr/docker-compose.yml` (lines 10-11)

**Description:** The development `docker-compose.yml` exposes PostgreSQL on port 5432 to the host. While this is only for development, it could be a concern on shared development machines or if the development compose file is accidentally used in a production-like environment.

The production compose file correctly does not expose the PostgreSQL port.

**Recommended fix:** Consider binding to localhost only:
```yaml
ports:
  - "127.0.0.1:5432:5432"
```

### L5. No Password Strength Enforcement Server-Side

**File(s):** `/home/regisp/code/popelec.fr/src/collections/Users/index.ts`, `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/compte/inscription/page.tsx` (line 123)

**Description:** The registration form has `minLength={8}` as an HTML attribute, but this is a client-side only check. There is no server-side password validation in the Users collection. Payload CMS does not enforce password complexity by default. An attacker can bypass the client-side check and register with a 1-character password via direct API call.

**Recommended fix:** Add a `beforeValidate` hook or use Payload's auth configuration to enforce minimum password length:
```typescript
auth: {
  tokenExpiration: 7200,
  verify: false,
  maxLoginAttempts: 5,
  lockTime: 600 * 1000,
  // Password length is enforced by Payload when using minLength
},
```
Or add a `beforeValidate` hook that checks password length.

---

## Positive Observations (what's done well)

1. **Stripe webhook signature verification** -- Properly uses `stripe.webhooks.constructEvent` with the raw body and signature header. Idempotency check prevents duplicate order creation.

2. **Access control on all collections** -- Every collection has all four access operations (read/create/update/delete) explicitly defined. No collection is left with default open access.

3. **Field-level access on sensitive fields** -- The `role` field has update protection (though create is missing, see C1). `seafilePasswordEncrypted` is properly hidden with `read: () => false` and `update: () => false`. `seafileEmail` is admin-read-only.

4. **AES-256-GCM encryption** -- Seafile passwords are encrypted with AES-256-GCM using random IVs and proper auth tag handling. The key derivation enforces a minimum length.

5. **Docker security** -- Production image runs as non-root user (uid 1001), uses multi-stage build to minimize attack surface, and only exposes port 3000 internally. PostgreSQL is not exposed in production.

6. **Nginx hardening** -- Server tokens hidden, security headers set, rate limiting on login/forgot-password/API write endpoints, dotfiles blocked, X-Powered-By stripped.

7. **Secret validation at startup** -- `PAYLOAD_SECRET` is validated at config load time with an explicit check that the dev default is not used in production.

8. **Seed script requires environment variable** -- The seed script requires `ADMIN_SEED_PASSWORD` from the environment rather than hardcoding a default password.

9. **Forgot-password timing-safe** -- The forgot-password page does not reveal whether an email exists in the system, always showing the same success message.

10. **No dangerouslySetInnerHTML** -- No use of `dangerouslySetInnerHTML` anywhere in the codebase. React's default escaping protects against XSS in rendered content.

11. **HSTS with preload** -- Strict-Transport-Security header is set with a 2-year max-age, includeSubDomains, and preload flag.

12. **Input validation on collection fields** -- Email, phone, SIRET, VAT number, and postal code fields have server-side validation functions with proper regex patterns.

13. **Localized URL handling** -- The `parseLocale` function safely falls back to French for unknown locale values, preventing locale injection.

14. **Good use of branded types** -- The type system prevents category confusion (e.g., mixing up product IDs with user IDs), which helps prevent authorization bypass bugs at the type level.
