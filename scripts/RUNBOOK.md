# Lunettiq Setup Runbook

Everything needed to set up a fresh environment (dev or production).
Run all commands from the project root.

## Prerequisites

1. Node.js 18+
2. `.env.local` filled in (copy from `.env.local.example`)
3. Neon database provisioned, `DATABASE_URL` set
4. Shopify store created with Admin API access token
5. Clerk account with publishable + secret keys
6. Inngest account with event key + signing key
7. Upstash Redis instance with REST URL + token

---

## Phase 1 — Database

Push the Drizzle schema to Neon:

```bash
npx drizzle-kit push
```

---

## Phase 2 — Shopify Setup

Run in this order. Each script is idempotent (safe to re-run).

### 2a. Register webhooks

Registers `customers/*`, `orders/*`, `products/*`, `collections/*` webhook subscriptions.

```bash
node --env-file=.env.local scripts/register-webhooks.mjs
```

### 2b. Create product metafield definitions

Defines frame measurements, material, rx_compatible, etc. on the PRODUCT owner type.

```bash
npx tsx scripts/create-product-metafields.ts
```

### 2c. Create customer metafield definitions

Defines `custom.prescriptions`, `custom.wishlist`, `custom.loyalty` on the CUSTOMER owner type.

```bash
npx tsx scripts/create-customer-metafields.ts
```

### 2d. Seed Shopify data (dev only)

Creates sample customers + orders from CSV. **Skip in production** — real data already exists.

```bash
node --env-file=.env.local scripts/seed-shopify.mjs
```

---

## Phase 3 — Backfill Projection Tables

Pulls existing Shopify customers, orders, products, and collections into Postgres projection tables.

```bash
node --env-file=.env.local scripts/backfill.mjs
```

### 3a. Backfill Square data (if applicable)

Imports historical Square transactions. Optional — only if migrating from Square.

```bash
npx tsx scripts/backfill-square.ts
# With date range:
npx tsx scripts/backfill-square.ts --from 2024-01-01 --to 2024-12-31
```

---

## Phase 4 — Seed Application Data

### 4a. Loyalty tiers

Inserts loyalty tier definitions (essential / cult / vault) into the database.

```bash
npx tsx scripts/seed-loyalty-tiers-v2.ts
```

> `seed-loyalty-tiers.ts` is the v1 version — use **v2** for current tier structure.

### 4b. Appointment types

Seeds appointment type options (e.g. eye exam, fitting, consultation).

```bash
npx tsx scripts/seed-appointment-types.ts
```

### 4c. Product feedback (dev only)

Seeds demo product feedback data. **Skip in production.**

```bash
npx tsx scripts/seed-product-feedback.ts
```

---

## Phase 5 — Clerk

Sets up the Clerk organization and configures the owner user with `publicMetadata` roles.

```bash
node --env-file=.env.local scripts/setup-clerk.mjs
```

---

## Phase 6 — Verify

1. Start the dev server: `npm run dev`
2. Start Inngest dev server: `npx inngest-cli@latest dev`
3. Open storefront: http://localhost:3000
4. Open CRM: http://localhost:3000/crm (requires Clerk auth)
5. Trigger a test webhook from Shopify admin to confirm the pipeline works

---

## Quick Reference

| Script | Runtime | Env Loading | Production? |
|---|---|---|---|
| `register-webhooks.mjs` | Node | `--env-file` | ✅ Yes |
| `create-product-metafields.ts` | tsx | `dotenv/config` | ✅ Yes |
| `create-customer-metafields.ts` | tsx | `dotenv/config` | ✅ Yes |
| `seed-shopify.mjs` | Node | `--env-file` | ❌ Dev only |
| `backfill.mjs` | Node | `--env-file` | ✅ Yes |
| `backfill-square.ts` | tsx | `dotenv/config` | ✅ If applicable |
| `seed-loyalty-tiers-v2.ts` | tsx | `dotenv/config` | ✅ Yes |
| `seed-appointment-types.ts` | tsx | `dotenv/config` | ✅ Yes |
| `seed-product-feedback.ts` | tsx | `dotenv/config` | ❌ Dev only |
| `setup-clerk.mjs` | Node | `--env-file` | ✅ Yes |
| `parse-metafields.ts` | tsx | `dotenv/config` | ✅ Yes |
| `import-live-store.ts` | tsx | `dotenv/config` | 🔧 One-time |
| `shopify-oauth.mjs` | Node | `--env-file` | 🔧 One-time |
| `import-orders-csv.mjs` | Node | `--env-file` | 🔧 One-time |

---

## Production Checklist (TL;DR)

### When connecting to the real Shopify store:

```bash
# 1. Import live data into projection tables
npx tsx scripts/import-live-store.ts

# 2. Create individual metafield definitions on the live store
npx tsx scripts/create-product-metafields.ts

# 3. Parse sizing_dimensions + composition into individual fields
npx tsx scripts/parse-metafields.ts
```

The parse-metafields script reads `custom.sizing_dimensions` (text block) and
`custom.composition` (multi-line text) from the DB, extracts individual values
(frame_width, bridge_width, lens_width, temple_length, lens_height, material,
acetate_source, hinge_type, lens_coating, uv_protection, included_accessories,
warranty), and writes them as separate metafields on Shopify.

Field mapping from sizing_dimensions:
- "Frame width: 118"  → custom.frame_width (number_integer)
- "Nose Bridge: 22"   → custom.bridge_width (number_integer)
- "Lens width: 53"    → custom.lens_width (number_integer)
- "Length: 150"        → custom.temple_length (number_integer)
- "Height: 41"        → custom.lens_height (number_integer)

### Standard setup:

```bash
# 1. Database
npx drizzle-kit push

# 2. Shopify
node --env-file=.env.local scripts/register-webhooks.mjs
npx tsx scripts/create-product-metafields.ts
npx tsx scripts/create-customer-metafields.ts

# 3. Backfill
node --env-file=.env.local scripts/backfill.mjs

# 4. Seed app data
npx tsx scripts/seed-loyalty-tiers-v2.ts
npx tsx scripts/seed-appointment-types.ts

# 5. Clerk
node --env-file=.env.local scripts/setup-clerk.mjs
```
