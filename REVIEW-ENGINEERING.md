# Code Review -- Senior Software Engineer

**Date**: 2026-04-05
**Reviewer**: Senior Software Engineer (automated review)
**Codebase**: popelec.fr -- Next.js 15 + Payload CMS 3.x + PostgreSQL e-commerce

---

## Summary

This is a well-structured e-commerce application with strong foundations: a coherent type system using branded types, proper i18n architecture via next-intl, sensible Payload CMS collections, and good Docker infrastructure. The codebase demonstrates deliberate architectural decisions and consistency.

However, several issues need attention before production launch, ranging from security concerns in the Stripe webhook to incorrect TVA calculations in the cart, missing `'use client'` directives, and incomplete pages (orders/quotes account pages show only static text). Below is the detailed analysis.

---

## Critical Issues (blocks deployment)

### C1. Stripe webhook does not verify payment status before creating order

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(payload)/api/stripe-webhook/route.ts`, lines 31-103

**Description**: When handling `checkout.session.completed`, the webhook creates an order immediately without checking `session.payment_status`. A checkout session can complete with `payment_status: 'unpaid'` (for example, with delayed payment methods). This could create orders for unpaid transactions.

**Recommended fix**:
```typescript
case 'checkout.session.completed': {
  const session = event.data.object
  if (session.payment_status !== 'paid') {
    // Handle async payment methods via checkout.session.async_payment_succeeded
    break
  }
  // ... rest of order creation
}
```
Also add a handler for `checkout.session.async_payment_succeeded` and `checkout.session.async_payment_failed`.

---

### C2. Cart TVA calculation is hardcoded to 20%, ignoring per-item TVA rates

**File(s)**:
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/panier/page.tsx`, line 18
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/commande/page.tsx`, line 22

**Description**: Both the cart page and checkout page compute TVA as `subtotalHT * 0.2`, completely ignoring the `tvaRate` field stored on each `DomainCartItem`. Products can have TVA rates of 20%, 10%, or 5.5%. This means customers see incorrect TTC prices whenever a product uses a non-standard TVA rate. For a French e-commerce site, displaying incorrect tax amounts is a legal compliance issue.

**Recommended fix**: Calculate TVA per-item using `tvaRateToMultiplier`:
```typescript
import { tvaRateToMultiplier } from '@/types/enums/tva-rate'

const tva = priceCents(
  items.reduce((sum, item) => {
    const rate = tvaRateToMultiplier(item.tvaRate)
    return sum + Math.round(item.priceHT * item.quantity * rate)
  }, 0)
)
```

---

### C3. Stripe webhook order items have empty `sku` and incorrect `priceHT`

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(payload)/api/stripe-webhook/route.ts`, lines 64-79

**Description**: The webhook maps line items but sets `sku: ''` for every item and uses `item.amount_total` (which is the total for that line, not the unit price) as `priceHT`. The `priceHT` field in the Orders collection should be the per-unit price, not the line total. Also, the `payloadId` is being read from the Stripe Product metadata, but the `create-checkout-session` route stores `payloadId` in `price_data.product_data.metadata`, which becomes metadata on the Stripe Product. This might work, but only after the product is created on Stripe's side. With inline prices (no pre-created Stripe products), the product may be ephemeral and the metadata flow is fragile.

**Recommended fix**:
- Store `sku` and `payloadId` in the Stripe checkout session metadata or line item metadata
- Use `item.amount_total / item.quantity` for per-unit price, or better yet, look up the Payload product directly to get the authoritative price and SKU
- Pass the full cart details in the session metadata so the webhook can reconstruct the order without relying solely on Stripe's line item data

---

### C4. Stripe is initialized eagerly even when `STRIPE_SECRET_KEY` is empty

**File(s)**: `/home/regisp/code/popelec.fr/src/lib/stripe.ts`, lines 1-6

**Description**: `new Stripe('')` is called at module load time with an empty string when `STRIPE_SECRET_KEY` is not set. This may throw or produce confusing errors at import time in environments where Stripe is not configured (dev, build, etc.). The webhook route checks for `STRIPE_WEBHOOK_SECRET` but the checkout route checks for `STRIPE_SECRET_KEY` -- both import from `@/lib/stripe` which would already fail.

**Recommended fix**: Use lazy initialization:
```typescript
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia', typescript: true })
  }
  return _stripe
}
```

---

### C5. Checkout page collects form data but never sends it to the API

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/commande/page.tsx`, lines 36-65

**Description**: The checkout form collects shipping/billing address fields via named inputs, but `handleSubmit` only sends `items` and `locale` to `/api/create-checkout-session`. All the shipping/billing form data is collected by the browser but completely ignored. This means the customer fills in address fields for nothing -- the data is lost.

**Recommended fix**: Either:
1. Remove the address form fields entirely and let Stripe Checkout handle address collection (via `shipping_address_collection` and `billing_address_collection` options on the Stripe session), or
2. Extract the form data and send it to the API, then store it in the session metadata or create the order with addresses before redirecting to Stripe

---

## Architecture & Design Issues

### A1. `force-dynamic` used on pages that could be statically generated or ISR

**File(s)**:
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/cgv/page.tsx`, line 1
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/mentions-legales/page.tsx`, line 1
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/politique-confidentialite/page.tsx`, line 1

**Description**: Legal pages (CGV, mentions legales, privacy policy) are marked `force-dynamic`, meaning they are server-rendered on every request. These pages change extremely rarely and are prime candidates for ISR (`revalidate: 3600` or similar). The `force-dynamic` was presumably added because `getPayload()` fails during build without a database -- but the pages already have `try/catch` fallbacks.

**Recommended fix**: Remove `force-dynamic` and use `revalidate`:
```typescript
export const revalidate = 3600 // Revalidate every hour
```
Or at minimum, use `dynamic = 'force-static'` with static fallback content, since these pages already have hardcoded fallback text.

---

### A2. Account pages (orders, quotes) are placeholder-only

**File(s)**:
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/compte/commandes/page.tsx`
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/compte/devis/page.tsx`

**Description**: Both pages just display static "no orders/quotes" text. They do not fetch any data from Payload CMS. Even when a user has orders, they will always see "Aucune commande". This makes the account section non-functional.

**Recommended fix**: Fetch orders/quotes for the authenticated user:
```typescript
const payload = await getPayload()
const { user } = await payload.auth({ headers: await headers() })
if (!user) redirect('/compte/connexion')

const orders = await payload.find({
  collection: 'orders',
  where: { customer: { equals: user.id } },
  sort: '-createdAt',
  limit: 20,
})
```

---

### A3. `useAuth` hook makes a network request on every page load

**File(s)**: `/home/regisp/code/popelec.fr/src/hooks/useAuth.ts`, lines 35-56

**Description**: The `useAuth` hook calls `/api/users/me` on every component mount. Since `Header` uses this hook and is rendered on every page, this means every page navigation triggers an API call. There is no caching, no SWR, no deduplication.

**Recommended fix**: Consider using React context at the layout level to fetch auth state once and share it, or use a library like `swr` or `@tanstack/react-query` with caching. Alternatively, pass the initial auth state from the server component layout to avoid the client-side fetch entirely.

---

### A4. Navigation globals (Navigation, SiteSettings) are defined but not used in the frontend

**File(s)**:
- `/home/regisp/code/popelec.fr/src/globals/Navigation.ts`
- `/home/regisp/code/popelec.fr/src/globals/SiteSettings.ts`

**Description**: The Navigation global has a full header/footer link structure, but the actual Header and Footer components use hardcoded categories and links. The SiteSettings global has company info and shipping costs, but these are not fetched or displayed anywhere. This means editing navigation or settings in the CMS admin has zero effect on the frontend.

**Recommended fix**: Either fetch and use these globals in the Header/Footer components, or remove them to avoid admin confusion. Using them would be the better approach for a CMS-driven site.

---

### A5. Rich text content from CMS is never actually rendered

**File(s)**:
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/cgv/page.tsx`, line 44
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/mentions-legales/page.tsx`, line 44
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/politique-confidentialite/page.tsx`, line 44
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/produits/[slug]/page.tsx`, lines 244-248

**Description**: When CMS content is loaded, the legal pages just render `<div>Contenu charge depuis le CMS</div>` -- a placeholder string. The product detail page shows `shortDescription` as plain text instead of rendering the `description` rich text field. Payload CMS uses Lexical rich text which requires the `@payloadcms/richtext-lexical` renderer to display properly.

**Recommended fix**: Use the Lexical serializer to render rich text content:
```typescript
import { RichText } from '@payloadcms/richtext-lexical/react'

// In the component:
{content?.content && <RichText data={content.content} />}
```

---

### A6. `isAdminOrSelf` access function is defined but never used

**File(s)**: `/home/regisp/code/popelec.fr/src/access/isAdminOrSelf.ts`

**Description**: This access control function exists but is not imported anywhere. The Users collection duplicates the same logic inline in its `read` and `update` access functions.

**Recommended fix**: Refactor the Users collection to use `isAdminOrSelf` instead of duplicating the logic:
```typescript
access: {
  read: isAdminOrSelf,
  update: isAdminOrSelf,
  // ...
}
```

---

## Type System Issues

### T1. `DomainCartItem.quantity` uses plain `number` instead of `Quantity`

**File(s)**: `/home/regisp/code/popelec.fr/src/types/cart.ts`, line 20

**Description**: The `DomainCartItem` interface declares `quantity: number` instead of using the `Quantity` branded type. Similarly, `DomainCartContext.addItem` and `updateQuantity` accept plain `number` for quantity. This violates the project's "no primitive obsession" principle -- a cart quantity should be distinguished from other numbers.

**Recommended fix**:
```typescript
import type { Quantity } from './quantity'

export interface DomainCartItem {
  // ...
  quantity: Quantity
}
```
Update `addItem`, `updateQuantity`, and the `CartProvider` accordingly.

---

### T2. Factory functions for branded types perform no validation

**File(s)**: `/home/regisp/code/popelec.fr/src/types/strings.ts`, `/home/regisp/code/popelec.fr/src/types/ids.ts`, `/home/regisp/code/popelec.fr/src/types/money.ts`, `/home/regisp/code/popelec.fr/src/types/quantity.ts`

**Description**: All factory functions (e.g., `email()`, `payloadId()`, `priceCents()`, `quantity()`) are simple type casts with no runtime validation. This means `email('not-an-email')` happily returns a branded `Email`. While zero-cost at runtime, the boundary converters are the one place where validation should happen to maintain the "make illegal states unrepresentable" guarantee at the domain boundary.

**Recommended fix**: Add optional runtime validation at the boundary:
```typescript
export function email(raw: string): Email {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    throw new Error(`Invalid email: ${raw}`)
  }
  return raw as Email
}
```
At minimum, add assertions for critical types like `priceCents` (must be non-negative integer) and `quantity` (must be non-negative integer).

---

### T3. Multiple `as` casts bypass the type system in Payload boundary code

**File(s)**:
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/produits/[slug]/page.tsx`, lines 65-66
- `/home/regisp/code/popelec.fr/src/components/products/ProductCard.tsx`, lines 23-24
- `/home/regisp/code/popelec.fr/src/components/admin/Dashboard.tsx`, various lines

**Description**: Throughout the codebase, Payload data is cast with `as PriceCents`, `as TVARate`, `as string`, etc. For example: `product.pricing.priceHT as PriceCents`. This is necessary at the Payload/domain boundary, but these casts are scattered inconsistently rather than going through a single mapping layer.

**Recommended fix**: Create a dedicated converter function that maps Payload `Product` to a domain `DomainProduct` type, performing all casts in one place. This centralizes the boundary crossing:
```typescript
// src/types/converters.ts
export function toDomainProduct(p: PayloadProduct): DomainProduct {
  return {
    id: payloadId(p.id),
    slug: productSlug(p.slug),
    priceHT: priceCents(p.pricing.priceHT),
    tvaRate: (p.pricing.tvaRate ?? TVARates.Standard) as TVARate,
    // ...
  }
}
```

---

### T4. Inconsistent use of distinct ID types

**File(s)**: `/home/regisp/code/popelec.fr/src/types/ids.ts`

**Description**: The type system defines only a single `PayloadId` type for all collections. Per the user's typing philosophy, there should be distinct types like `ProductId`, `CategoryId`, `OrderId`, `UserId` to prevent accidentally passing a product ID where a user ID is expected. The `CartProductId` (a string) partially addresses this for the cart, but the core Payload ID types are not differentiated.

**Recommended fix**: Define collection-specific ID types:
```typescript
export type ProductId = Brand<number, 'ProductId'>
export type CategoryId = Brand<number, 'CategoryId'>
export type OrderId = Brand<number, 'OrderId'>
export type UserId = Brand<number, 'UserId'>
```

---

## Component Issues

### CO1. `Footer` component missing `'use client'` directive

**File(s)**: `/home/regisp/code/popelec.fr/src/components/layout/Footer.tsx`

**Description**: The `Footer` component uses `useTranslations` which is a client-only hook, but does not have the `'use client'` directive. This works because it is rendered inside the layout where `NextIntlClientProvider` wraps it, and the parent `Header` component is a client component, but it is incorrect and fragile. If the Footer is ever imported independently, it will fail.

**Recommended fix**: Add `'use client'` at the top of the file, or refactor to use `getTranslations` from `next-intl/server` and make it a server component.

---

### CO2. `ProductCard` uses `useTranslations` without `'use client'` directive

**File(s)**: `/home/regisp/code/popelec.fr/src/components/products/ProductCard.tsx`

**Description**: `ProductCard` calls `useTranslations('common')` but has no `'use client'` directive. Same issue as the Footer -- it relies on being rendered inside a client boundary indirectly through `ProductGrid`.

**Recommended fix**: Add `'use client'` to `ProductCard.tsx`, or refactor to pass translated strings as props from a server component parent.

---

### CO3. `ProductGrid` and `ProductCard` should use `Link` from `next-intl/navigation` instead of raw `<a>` tags

**File(s)**:
- `/home/regisp/code/popelec.fr/src/components/products/ProductCard.tsx`, line 28
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/page.tsx`, lines 33-40

**Description**: `ProductCard` uses a raw `<a href={...}>` tag for navigation. This causes a full page reload instead of client-side navigation. The home page also uses raw `<a>` tags for CTA buttons. This degrades performance and user experience.

**Recommended fix**: Use the `Link` component from `@/i18n/navigation` for internal links:
```typescript
import { Link } from '@/i18n/navigation'

<Link href={{ pathname: '/produits/[slug]', params: { slug: product.slug } }}>
```

---

### CO4. Header logo uses `<img>` instead of `next/image`

**File(s)**:
- `/home/regisp/code/popelec.fr/src/components/layout/Header.tsx`, line 52
- `/home/regisp/code/popelec.fr/src/components/layout/Footer.tsx`, line 19

**Description**: The logo is rendered with a plain `<img>` tag instead of the Next.js `Image` component. While this is fine for SVGs in many cases, it bypasses Next.js image optimization and may cause Lighthouse warnings.

**Recommended fix**: For SVGs, using `<img>` is acceptable, but ensure the alt text is appropriate. Alternatively, inline the SVG or use `next/image` with `unoptimized` for SVGs.

---

### CO5. Mobile menu button has hardcoded English aria-labels

**File(s)**: `/home/regisp/code/popelec.fr/src/components/layout/Header.tsx`, line 152

**Description**: `aria-label={mobileOpen ? 'Close menu' : 'Open menu'}` is always in English regardless of locale. Same issue with `AddToCartButton.tsx` lines 32 and 46 ("Decrease quantity", "Increase quantity"). Accessibility strings should be translated.

**Recommended fix**: Add translation keys for these aria-labels:
```typescript
aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
```

---

### CO6. Layout skip-to-content link text is hardcoded in English

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/layout.tsx`, line 37

**Description**: The "Skip to content" accessibility link text is hardcoded as English, not using i18n.

**Recommended fix**: Use a translation key or at least add the French equivalent based on locale.

---

## API & Data Issues

### D1. In-memory rate limiter does not work across multiple instances

**File(s)**: `/home/regisp/code/popelec.fr/src/lib/rateLimit.ts`

**Description**: The rate limiter uses an in-memory `Map`. In production with `output: 'standalone'`, if multiple Node.js processes or container replicas are used, each will have its own independent rate limit store. An attacker could distribute requests across instances to bypass limits.

**Recommended fix**: For launch with a single container, this is acceptable. Document the limitation. For scaling, switch to Redis-backed rate limiting (e.g., `@upstash/ratelimit`).

---

### D2. Rate limiter `setInterval` creates a module-level side effect

**File(s)**: `/home/regisp/code/popelec.fr/src/lib/rateLimit.ts`, lines 11-16

**Description**: The `setInterval` at module level creates a timer that runs indefinitely. This can cause issues with hot module replacement in development and with test environments. The interval also prevents the Node.js process from exiting cleanly since `setInterval` keeps the event loop alive (unless `unref()` is called).

**Recommended fix**: Call `.unref()` on the interval so it doesn't prevent process exit:
```typescript
const cleanup = setInterval(() => { ... }, 60_000)
cleanup.unref()
```

---

### D3. Import catalog price detection heuristic is fragile

**File(s)**: `/home/regisp/code/popelec.fr/src/lib/importCatalog.ts`, lines 101-106

**Description**: The logic `priceNum < 100000 ? Math.round(priceNum * 100) : Math.round(priceNum)` assumes prices under 100000 are in euros and should be converted to cents. But an industrial electrical cabinet could legitimately cost EUR 999.99 (99999 cents) or a bulk order could list EUR 1000 (which would NOT be converted because 1000 < 100000... wait, it would be). The threshold of 100000 means any price under EUR 1000 is treated as euros, but any price of EUR 1000+ would be treated as already in cents. This is ambiguous and error-prone.

**Recommended fix**: Require explicit column naming or a "unit" indicator in the spreadsheet (e.g., "Prix HT (EUR)" vs "Prix HT (centimes)"). Or default to one interpretation and document it clearly. A `priceUnit` parameter on the import API would be safest.

---

### D4. Seafile auth token is passed in URL query parameter

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/partage/[slug]/page.tsx`, line 56

**Description**: The Seafile authentication token is appended to the URL: `${data.url}/#/lib/${data.libraryId}/?token=${data.token}`. Tokens in URLs are logged by web servers, proxies, and browser history, creating a security risk. This may be a Seafile limitation, but it should be documented and mitigated where possible.

**Recommended fix**: If Seafile supports cookie-based authentication, prefer that. If the URL token is the only option, ensure the token has a short TTL and document the security trade-off. Consider setting `Referrer-Policy: no-referrer` on the redirect to prevent token leakage via the Referer header (already set to `strict-origin-when-cross-origin` in next.config.mjs, which is good but could be tighter for this specific redirect).

---

### D5. Orders collection `tvaRate` field is `type: 'text'` instead of `type: 'select'`

**File(s)**: `/home/regisp/code/popelec.fr/src/collections/Orders/index.ts`, line 57

**Description**: The `items[].tvaRate` field in the Orders collection is defined as `type: 'text'` instead of using the TVARate enum with `type: 'select'` and `enumToPayloadOptions`. This allows any arbitrary string to be stored as a TVA rate on an order item.

**Recommended fix**: Use the same pattern as Products:
```typescript
{
  name: 'tvaRate',
  type: 'select',
  required: true,
  options: enumToPayloadOptions(TVA_RATE_LABELS),
}
```

---

### D6. `decryptPassword` has a subtle buffer concatenation bug

**File(s)**: `/home/regisp/code/popelec.fr/src/lib/seafile.ts`, line 177

**Description**: `decipher.update(ciphertext)` returns a `Buffer`, then `+ decipher.final('utf8')` concatenates a string to a Buffer using `+`. When a Buffer is on the left side of `+` with a string on the right, Node.js converts the Buffer to a string using its default encoding (utf8), so it happens to work. However, this is fragile and relies on implicit coercion. If the plaintext contains multi-byte UTF-8 characters that span the update/final boundary, the intermediate Buffer-to-string conversion could produce garbled output.

**Recommended fix**:
```typescript
const updated = decipher.update(ciphertext)
const final = decipher.final()
return Buffer.concat([updated, final]).toString('utf8')
```

---

## Performance Issues

### P1. N+1 queries in catalog import

**File(s)**: `/home/regisp/code/popelec.fr/src/lib/importCatalog.ts`, lines 66-180

**Description**: For each row in the spreadsheet, the import function makes 2-3 database queries: one to check if the product exists, one to resolve the category, and one to create/update. For a catalog of 1000 products, this is 2000-3000 sequential database queries. This will be extremely slow.

**Recommended fix**: Pre-fetch all existing products and categories in bulk before the loop:
```typescript
const allProducts = await payload.find({ collection: 'products', pagination: false, select: { sku: true } })
const existingSKUs = new Map(allProducts.docs.map(p => [p.sku, p.id]))

const allCategories = await payload.find({ collection: 'categories', pagination: false })
const categoryMap = new Map(allCategories.docs.map(c => [c.name, c.id]))
```
Then perform lookups against the in-memory maps inside the loop.

---

### P2. Dashboard makes 9 parallel database queries, some scanning all orders

**File(s)**: `/home/regisp/code/popelec.fr/src/components/admin/dashboard-queries.ts`, lines 29-133

**Description**: The `paidOrdersResult` query fetches ALL non-cancelled/non-refunded orders with `pagination: false` just to sum up revenue. As the order count grows, this will become a significant performance bottleneck. Similarly, the product status counts and user role counts perform N+M individual `count` queries (one per status/role value).

**Recommended fix**: Use database-level aggregation for revenue totals. For Payload CMS, this might require a raw SQL query or a custom endpoint. For the status/role counts, consider a single query that fetches all documents with a group-by approach.

---

### P3. `itemCount` and `subtotalHT` are recomputed on every render, not memoized

**File(s)**: `/home/regisp/code/popelec.fr/src/components/cart/CartProvider.tsx`, lines 68-69

**Description**: `itemCount` and `subtotalHT` are computed inline in the component body, meaning they are recalculated on every render of `CartProvider`. While the computation is not expensive for small carts, these values should be memoized with `useMemo` to follow React best practices and prevent unnecessary recalculations when only unrelated state changes.

**Recommended fix**:
```typescript
const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])
const subtotalHT = useMemo(
  () => priceCents(items.reduce((sum, i) => sum + i.priceHT * i.quantity, 0)),
  [items]
)
```

---

### P4. Product detail page makes two sequential Payload queries for metadata and content

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/produits/[slug]/page.tsx`

**Description**: `generateMetadata` queries the product (lines 30-36), then the page component queries the same product again (lines 52-58). Next.js does cache `fetch` calls, but Payload's `payload.find()` uses direct database access, not `fetch`. This means the same product is queried twice for every product page load.

**Recommended fix**: Use React's `cache()` function to deduplicate:
```typescript
import { cache } from 'react'

const getProduct = cache(async (slug: string, locale: Locale) => {
  const payload = await getPayload()
  return payload.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 2,
  })
})
```

---

## i18n Issues

### I1. Hardcoded French strings in the quote page

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/devis/page.tsx`, line 148

**Description**: `"Produits"` heading is hardcoded in French (line 148). The error messages `"Une erreur est survenue"` (lines 77, 80, 84) are also hardcoded in French rather than using `tCommon('error')`.

**Recommended fix**: Use translation keys for all user-visible strings:
```typescript
<h2 className="text-lg font-semibold mb-4">{t('productsHeading')}</h2>
```

---

### I2. Legal pages have inline French/English content instead of using i18n

**File(s)**:
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/cgv/page.tsx`
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/mentions-legales/page.tsx`
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/politique-confidentialite/page.tsx`

**Description**: All three legal pages use inline ternaries like `locale === Locales.Fr ? 'French text' : 'English text'` for every paragraph. This is a maintenance nightmare and doesn't scale. The content should come from the CMS (the Pages collection exists for exactly this purpose) or from translation files.

**Recommended fix**: Move this content to the CMS Pages collection and actually render the rich text (see A5). The hardcoded fallback is fine for development but should be replaced with proper CMS content before launch.

---

### I3. `cart.tva` translation key is hardcoded to "TVA (20%)"

**File(s)**: `/home/regisp/code/popelec.fr/messages/fr.json`, line 91; `/home/regisp/code/popelec.fr/messages/en.json`, line 90

**Description**: The translation keys `cart.tva` are `"TVA (20%)"` and `"VAT (20%)"`. If the cart contains items with different TVA rates, the label is misleading. Related to C2 (hardcoded 20% TVA calculation).

**Recommended fix**: When fixing C2, update the label to be dynamic or use a generic label like "TVA" / "VAT" without the percentage.

---

### I4. Root not-found page is hardcoded in French only

**File(s)**: `/home/regisp/code/popelec.fr/src/app/not-found.tsx`

**Description**: The root-level 404 page renders French text only ("Page introuvable", "Retour a l'accueil"). Users who navigate to an invalid URL will always see French regardless of their browser language preference.

**Recommended fix**: Detect the preferred locale from the `Accept-Language` header or default to showing both languages, or redirect to `/${locale}/not-found`.

---

## Code Quality Issues

### Q1. Duplicate ORDER_STATUS_LABELS, PRODUCT_STATUS_LABELS maps across files

**File(s)**:
- `/home/regisp/code/popelec.fr/src/collections/Products/index.ts`, lines 7-12
- `/home/regisp/code/popelec.fr/src/collections/Orders/index.ts`, lines 6-14
- `/home/regisp/code/popelec.fr/src/components/admin/Dashboard.tsx`, lines 12-58

**Description**: Status label maps (ORDER_STATUS_LABELS, PRODUCT_STATUS_LABELS, QUOTE_STATUS_LABELS, USER_ROLE_LABELS) are defined in at least 2-3 different files with identical content. This is a maintenance hazard -- if a new status is added, it must be updated in multiple places.

**Recommended fix**: Define each label map once in the corresponding enum file (e.g., `src/types/enums/order-status.ts`) and export it:
```typescript
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatuses.Pending]: 'En attente de paiement',
  // ...
}
```
Then import it in both the collection config and the Dashboard.

---

### Q2. `console.error` used instead of structured logging in API routes

**File(s)**:
- `/home/regisp/code/popelec.fr/src/app/(payload)/api/create-checkout-session/route.ts`, line 106
- `/home/regisp/code/popelec.fr/src/app/(payload)/api/stripe-webhook/route.ts`, lines 60, 133
- `/home/regisp/code/popelec.fr/src/app/(payload)/api/import-catalog/route.ts`, line 45
- `/home/regisp/code/popelec.fr/src/app/(payload)/api/seafile-auth/[slug]/route.ts`, line 64

**Description**: API routes use `console.error` for error logging. In production, this should use Payload's structured logger (`payload.logger`) for consistent log formatting, correlation IDs, and log level control.

**Recommended fix**: Use `payload.logger.error()` instead of `console.error()` where the payload instance is available.

---

### Q3. Inconsistent naming between `isLoggedIn` access function and inline checks

**File(s)**: `/home/regisp/code/popelec.fr/src/access/isLoggedIn.ts`

**Description**: `isLoggedIn` is defined but never imported anywhere. All collections inline their auth checks. The codebase has three access helpers (`isAdmin`, `isAdminOrSelf`, `isLoggedIn`) but only `isAdmin` is consistently used.

**Recommended fix**: Use the existing helpers consistently across all collections to reduce code duplication and ensure uniform access control patterns.

---

### Q4. Missing `aria-hidden` on decorative SVGs in some components

**File(s)**:
- `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/page.tsx`, lines 53-55, 63-64, 72
- `/home/regisp/code/popelec.fr/src/components/products/ProductCard.tsx`, lines 44-46

**Description**: Several decorative SVG icons lack `aria-hidden="true"`, which means screen readers will attempt to announce them. The Header component correctly uses `aria-hidden="true"` on most icons, but other components are inconsistent.

**Recommended fix**: Add `aria-hidden="true"` to all decorative SVGs that are paired with visible text labels.

---

### Q5. Confirmation page does not clear the cart after successful payment

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/commande/confirmation/page.tsx`

**Description**: After a successful Stripe payment, the user lands on the confirmation page, but the cart in localStorage is never cleared. If the user navigates back to the cart, they will see the same items they just purchased.

**Recommended fix**: Make the confirmation page a client component that calls `clearCart()` on mount, or handle it in the checkout flow before redirecting to Stripe.

---

### Q6. `searchParams` `session_id` is unused on confirmation page

**File(s)**: `/home/regisp/code/popelec.fr/src/app/(frontend)/[locale]/commande/confirmation/page.tsx`, line 14

**Description**: `_searchParams` is destructured and immediately discarded. The `session_id` should be used to fetch the Stripe session and display order details (order number, email confirmation, etc.).

**Recommended fix**: Use the `session_id` to retrieve session details from Stripe and display the order number and confirmation email to the user.

---

### Q7. Products and categories use `slug` as plain text field without auto-generation

**File(s)**:
- `/home/regisp/code/popelec.fr/src/collections/Products/index.ts`, lines 43-47
- `/home/regisp/code/popelec.fr/src/collections/Categories/index.ts`, lines 27-30

**Description**: The `slug` field on Products and Categories is a required text field that must be manually entered. There is no `beforeValidate` hook to auto-generate it from the `name` field. This creates friction for CMS users who must manually type slugs and increases the risk of inconsistent slug formatting.

**Recommended fix**: Add a `beforeValidate` hook that generates the slug from the name if not provided:
```typescript
hooks: {
  beforeValidate: [({ data }) => {
    if (data && !data.slug && data.name) {
      data.slug = slugify(data.name)
    }
    return data
  }],
}
```

---

### Q8. Stripe API version is pinned to a specific date version

**File(s)**: `/home/regisp/code/popelec.fr/src/lib/stripe.ts`, line 4

**Description**: `apiVersion: '2025-02-24.acacia'` pins to a specific Stripe API version. This is actually good practice for stability, but note that the `@stripe/stripe-js` and `stripe` packages in `package.json` use `^` ranges which could auto-upgrade to versions that expect a different API version. Document the pinned version and test when upgrading Stripe packages.

**Recommended fix**: Pin the Stripe packages to exact versions in `package.json`, or at least document the API version choice.

---

## Positive Observations

1. **Excellent type system foundation**: The branded type infrastructure (`Brand<T, B>`) with factory functions is well-designed. The enum pattern using `as const` objects with derived types is TypeScript best practice and avoids the pitfalls of native enums.

2. **Clean separation of concerns**: The `src/types/`, `src/access/`, `src/lib/`, `src/collections/` structure is well-organized. The `enumToPayloadOptions` helper bridges domain types to CMS configuration elegantly.

3. **Security-conscious middleware**: The maintenance mode middleware correctly validates JWT format, bypasses static assets and auth pages, and redirects logged-in users away from coming-soon. The CSP headers in `next.config.mjs` are well-configured.

4. **Idempotent webhook handling**: The Stripe webhook checks for duplicate orders by `stripeCheckoutSessionId` before creating, which prevents double-processing of webhook events.

5. **Proper i18n architecture**: The next-intl routing with pathname translations (French URLs by default, English alternatives) is correctly configured. Translation files are complete and have matching keys between FR and EN.

6. **Good Docker setup**: Multi-stage Dockerfile with proper non-root user, standalone output, separate migration stage. The dev/prod docker-compose split is clean. Health checks on database services are proper.

7. **Accessibility basics covered**: Skip-to-content link, aria-labels on icon-only buttons, `role="search"` on search forms, `aria-expanded` on mobile menu toggle, `aria-live="polite"` on cart quantity display.

8. **Defensive coding in boundary converters**: `cartItemsFromJSON` validates array structure and provides sensible defaults for missing fields. The TVA rate fallback is particularly careful.

9. **Seafile password encryption**: Using AES-256-GCM with proper IV/authTag handling for storing Seafile passwords is a solid choice. The encryption key length validation in `getEncryptionKey()` is good.

10. **Test coverage for core utilities**: The `formatPrice`, `validation`, and type converter tests provide good coverage of the foundational utility functions.
