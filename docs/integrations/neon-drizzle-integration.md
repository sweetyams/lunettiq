# Neon Postgres + Drizzle ORM

**Purpose:** Primary database for all CRM data, projection cache, and loyalty system.

## How It Works

Neon provides serverless Postgres. Drizzle ORM provides type-safe queries and schema management. The database holds both Shopify/Square projection tables (read cache) and CRM-owned tables (source of truth).

## Schema Overview

### Projection Tables (synced from Shopify/Square)
- `customers_projection` — customer profiles
- `orders_projection` — order history (with `source` column: shopify/square)
- `products_projection` — product catalog
- `product_variants_projection` — variant details
- `collections_projection` — collection membership

### CRM-Owned Tables
- `interactions` — notes, calls, visits
- `appointments` — booking system
- `second_sight_intakes` — trade-in program
- `custom_designs` — custom frame orders
- `credits_ledger` — credits + points (dual currency)
- `preferences_derived` — AI-computed preferences
- `segments` — customer segments
- `audit_log` — all CRM actions

### Loyalty V2 Tables
- `loyalty_tiers` — configurable tier definitions
- `referrals` — referral tracking + fraud signals
- `membership_trials` — CULT trial tracking
- `gift_memberships` — gift membership codes
- `brand_events` + `event_invites` — VAULT events
- `archive_votes` — annual archive reissue vote
- `gift_fulfilments` — VAULT gift dispatch tracking

### Supporting Tables
- `locations` — store locations (Shopify + Square IDs)
- `staff_schedules` — staff working hours
- `appointment_types` — configurable appointment services
- `notifications` — in-app staff notifications
- `product_interactions` + `product_feedback` — product sentiment
- `try_on_sessions` — virtual try-on tracking
- `duplicate_candidates` + `client_links` — customer dedup/linking

## Files

| File | Purpose |
|---|---|
| `src/lib/db/index.ts` | Database connection (Neon serverless driver) |
| `src/lib/db/schema.ts` | Full schema definition (Drizzle) |
| `drizzle.config.ts` | Drizzle Kit configuration |

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/lunettiq?sslmode=require
```

### Where to Find

1. Go to [console.neon.tech](https://console.neon.tech)
2. Select your project → Connection Details
3. Copy the connection string

## Schema Management

```bash
# Push schema changes to database:
npx drizzle-kit push

# Generate migration SQL (for review):
npx drizzle-kit generate

# View current schema diff:
npx drizzle-kit check
```

Always use `npx drizzle-kit push` after modifying `schema.ts`.

## Production

Neon provides separate branches for dev/staging/production. Use different `DATABASE_URL` values per environment in Vercel.

Neon auto-scales and suspends idle connections. No connection pooling config needed — the serverless driver handles it.
