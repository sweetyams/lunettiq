# Lunettiq

Premium eyewear storefront + CRM, built on Next.js 14 (App Router).

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, Framer Motion |
| Database | Postgres (Neon) via Drizzle ORM |
| Staff Auth | Clerk |
| Customer Auth | Shopify Customer Accounts |
| Background Jobs | Inngest |
| Cache | Upstash Redis |
| Commerce | Shopify (source of truth) |
| Deployment | Vercel |

## Getting Started

```bash
# Install dependencies
npm install --legacy-peer-deps

# Copy env vars
cp .env.local.example .env.local
# Fill in all values (see Environment Variables below)

# Generate/push database schema
npx drizzle-kit push

# Run dev server
npm run dev

# Run Inngest dev server (separate terminal)
npx inngest-cli@latest dev
```

Open [http://localhost:3000](http://localhost:3000) for the storefront.
Open [http://localhost:3000/crm](http://localhost:3000/crm) for the CRM (requires Clerk auth).

## Environment Variables

See `.env.local.example` for all required variables:

- **Shopify**: Store domain, Storefront API token, Admin API token, webhook HMAC secret, Customer Account OAuth credentials
- **Neon**: `DATABASE_URL` — Postgres connection string
- **Clerk**: Publishable key + secret key for staff authentication
- **Inngest**: Event key + signing key for background job processing
- **Upstash**: Redis REST URL + token for caching

## Architecture

```
Shopify (source of truth)
  ↓ webhooks
Inngest (background processor)
  ↓ upserts
Postgres / Neon (projection cache + CRM-owned data)
  ↑ reads
CRM Web App (/crm/*)  |  Storefront (/)
```

### Database Schema

**Projection tables** (Shopify mirror, read-only):
- `customers_projection`, `orders_projection`, `products_projection`, `product_variants_projection`, `collections_projection`

**CRM-owned tables**:
- `interactions`, `second_sight_intakes`, `appointments`, `custom_designs`, `credits_ledger`, `preferences_derived`, `audit_log`, `segments`

### CRM Routes

| Route | Purpose |
|---|---|
| `/crm/clients` | Client list with search + filters |
| `/crm/clients/[id]` | Client profile (3-column layout) |
| `/crm/products` | Product catalogue browser |
| `/crm/segments` | Segment builder with rule engine |
| `/crm/second-sight` | Second Sight intake queue |
| `/crm/appointments` | Appointment management |
| `/crm/settings` | Tags, locations, staff, audit log |

### Webhook Pipeline

Shopify webhooks → `/api/webhooks/shopify` (HMAC verified) → Inngest events → idempotent upserts to projection tables.

Supported topics: `customers/*`, `orders/*`, `products/*`, `collections/*`.

## Clerk Role Setup

Staff roles are stored in Clerk user `publicMetadata`:

```json
{
  "role": "owner",
  "locationIds": ["loc_plateau", "loc_dix30"]
}
```

Roles: `owner`, `manager`, `sa`, `readonly`.

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest
npx drizzle-kit push # Push schema to database
npx drizzle-kit generate # Generate migration SQL
```
