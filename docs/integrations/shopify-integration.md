# Shopify Integration

**Status:** Live (production)  
**Date:** 2026-04-18  
**Role:** Source of truth for products, customers, and online orders

---

## Overview

Shopify is the primary commerce platform. The CRM maintains a read-optimized projection of Shopify data in Postgres, kept in sync via webhooks. The Admin API is used for write-through operations (updating customer data, tags, metafields).

```
Shopify Store
  ↓ webhooks (HMAC verified)
/api/webhooks/shopify
  ↓ events
Inngest (background processor)
  ↓ idempotent upserts
Postgres projection tables
  ↑ reads
CRM + Storefront
```

## What Syncs

### Shopify → CRM (via webhooks)

| Shopify Event | Inngest Function | Target Table |
|---|---|---|
| `customers/create`, `customers/update` | `syncCustomer` | `customers_projection` |
| `orders/create`, `orders/updated` | `syncOrder` | `orders_projection` |
| `orders/create`, `orders/updated` | `inventoryOnOrder` | `inventory_levels` + `inventory_adjustments` |
| `products/create`, `products/update` | `syncProduct` | `products_projection` + `product_variants_projection` |
| `collections/create`, `collections/update` | `syncCollection` | `collections_projection` |

### CRM → Shopify (via Admin API)

| CRM Action | Shopify API Call |
|---|---|
| Edit customer name/email/phone | `PUT /admin/api/customers/{id}.json` |
| Update customer tags | `PUT /admin/api/customers/{id}.json` |
| Set customer metafields | GraphQL `customerUpdate` mutation |
| Upload files (photos) | GraphQL `stagedUploadsCreate` + `fileCreate` |
| Push inventory levels | GraphQL `inventorySetQuantities` mutation |

All CRM→Shopify writes go through `src/lib/crm/shopify-admin.ts`.

## Architecture

### Files

| File | Purpose |
|---|---|
| `src/lib/shopify/storefront.ts` | Storefront API client (product queries, cart) |
| `src/lib/shopify/customer.ts` | Customer Account API client (profile, orders) |
| `src/lib/shopify/auth.ts` | Customer OAuth flow (login, tokens, refresh) |
| `src/lib/crm/shopify-admin.ts` | Admin API client (customer updates, metafields) |
| `src/app/api/webhooks/shopify/route.ts` | Webhook receiver + HMAC verification |
| `src/lib/inngest/functions.ts` | Sync functions (customer, order, product, collection) |
| `scripts/register-webhooks.mjs` | Register webhook subscriptions |
| `scripts/backfill.mjs` | Pull historical data from Shopify |

### Three Shopify APIs Used

| API | Auth | Purpose |
|---|---|---|
| **Storefront API** | Public access token | Product queries, cart, collections (storefront) |
| **Customer Account API** | OAuth (per-customer) | Customer profile, orders, prescriptions (account pages) |
| **Admin API** | Private access token | CRM write-through, webhooks, metafields |

---

## Environment Variables

```env
# Storefront API (public — safe for client-side)
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your-storefront-token

# Customer Account API (OAuth)
SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID=your-client-id
SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET=your-client-secret

# Admin API (private — server-side only)
SHOPIFY_ADMIN_API_ACCESS_TOKEN=your-admin-token
SHOPIFY_WEBHOOK_SECRET=your-webhook-hmac-secret

# App URL (for OAuth redirects)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Where to Find These

1. **Store domain**: Your `.myshopify.com` URL
2. **Storefront token**: Shopify Admin → Settings → Apps → Develop apps → your app → Storefront API access token
3. **Admin token**: Same app → Admin API access token
4. **Webhook secret**: Same app → Webhooks → Signing secret
5. **Customer Account API**: Shopify Admin → Settings → Customer accounts → Customer Account API credentials

---

## Webhook Setup

### Register Webhooks

```bash
# Default (uses lunettiq.vercel.app):
node --env-file=.env.local scripts/register-webhooks.mjs

# Custom URL:
node --env-file=.env.local scripts/register-webhooks.mjs https://yourdomain.com/api/webhooks/shopify
```

### Registered Topics

| Topic | Inngest Event | What It Triggers |
|---|---|---|
| `customers/create` | `shopify/customer.updated` | Upsert customer projection |
| `customers/update` | `shopify/customer.updated` | Upsert customer projection |
| `orders/create` | `shopify/order.updated` | Upsert order projection + commit inventory + loyalty points |
| `orders/updated` | `shopify/order.updated` | Update order status; on fulfillment: decrement on_hand + committed; on cancel: release committed |
| `products/create` | `shopify/product.updated` | Upsert product + variants projection, auto-assign family |
| `products/update` | `shopify/product.updated` | Upsert product + variants projection |
| `collections/create` | `shopify/collection.updated` | Upsert collection projection |
| `collections/update` | `shopify/collection.updated` | Upsert collection projection |

**Not registered (covered by `orders/updated`):**
- `orders/cancelled` — `orders/updated` fires on cancel; handler checks `cancelled_at`
- `orders/fulfilled` — `orders/updated` fires on fulfill; handler checks `fulfillment_status`

**Not registered (optional):**
- `products/delete` — rare; handled in route if registered
- `draft_orders/*` — not a valid Shopify webhook topic; draft order completion fires `orders/create`

### Inventory Flow

When a Shopify order webhook fires, `inventoryOnOrder` (Inngest) runs:

```
orders/create (new order, paid/authorized)
  → resolve each line item variant → family + colour
  → route to fulfilling location with highest available stock
  → committed += qty at that location
  → projectToChannels() → push to Shopify + Square

orders/updated (fulfilled)
  → on_hand -= qty, committed -= qty at order location
  → projectToChannels()

orders/updated (cancelled)
  → committed -= qty at order location
  → projectToChannels()
```

Shopify never has stale inventory — `projectToChannels()` pushes the CRM's computed available count back to Shopify via `inventorySetQuantities` after every adjustment.

### Draft Order Checkout

Draft orders don't have webhook topics. The flow is:

```
CRM creates draft order → Shopify returns checkout URL
  → Customer pays → Shopify converts to real order
  → orders/create webhook fires → inventory commits
```

The `syncDraftOrder` Inngest function handles CRM-side projection of draft orders, triggered by CRM API calls (not webhooks).

### Verification

Every webhook is HMAC-verified using `SHOPIFY_WEBHOOK_SECRET`. Invalid signatures return 401.

---

## Backfill Historical Data

For initial setup or recovery, pull all existing data from Shopify:

```bash
node --env-file=.env.local scripts/backfill.mjs
```

This pulls:
- All customers (paginated)
- All orders (paginated)
- All products + variants
- All collections

Each record goes through the same Inngest sync pipeline as webhooks. Safe to run multiple times (idempotent upserts).

---

## Moving to Production

### Step 1: Create a Shopify Custom App

1. Shopify Admin → Settings → Apps and sales channels → Develop apps
2. Create app → name it "Lunettiq Headless"
3. Configure API scopes:

**Admin API scopes needed:**
- `read_customers`, `write_customers`
- `read_orders`
- `read_products`
- `read_inventory`
- `read_content`

**Storefront API scopes needed:**
- `unauthenticated_read_product_listings`
- `unauthenticated_read_product_inventory`
- `unauthenticated_read_collection_listings`
- `unauthenticated_write_checkouts`
- `unauthenticated_read_content`

4. Install the app → copy all tokens

### Step 2: Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=lunettiq.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=<storefront-token>
SHOPIFY_ADMIN_API_ACCESS_TOKEN=<admin-token>
SHOPIFY_WEBHOOK_SECRET=<webhook-signing-secret>
SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID=<client-id>
SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET=<client-secret>
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 3: Register Webhooks

```bash
node --env-file=.env.local scripts/register-webhooks.mjs https://yourdomain.com/api/webhooks/shopify
```

### Step 4: Backfill

```bash
node --env-file=.env.local scripts/backfill.mjs
```

### Step 5: Configure Customer Accounts

1. Shopify Admin → Settings → Customer accounts
2. Enable "New customer accounts"
3. Add your domain as an allowed redirect URL
4. Copy Client ID and Secret to env vars

### Step 6: Verify

1. Create/update a customer in Shopify Admin → check CRM
2. Place a test order → check `orders_projection`
3. Update a product → check `products_projection`
4. Log in as a customer on the storefront → verify account pages

---

## Projection Tables

The CRM doesn't query Shopify directly. It reads from local projection tables that mirror Shopify data:

| Table | Primary Key | Synced Fields |
|---|---|---|
| `customers_projection` | `shopify_customer_id` | name, email, phone, tags, addresses, metafields, consent |
| `orders_projection` | `shopify_order_id` | customer, line items, totals, status, timestamps |
| `products_projection` | `shopify_product_id` | title, vendor, type, tags, images, prices, metafields |
| `product_variants_projection` | `shopify_variant_id` | title, SKU, price, inventory, image |
| `collections_projection` | `shopify_collection_id` | title, handle, product IDs |

**CRM-owned (not projections — Shopify is the downstream consumer):**

| Table | Key | Purpose |
|---|---|---|
| `inventory_levels` | `family_id + colour + location_id` | Canonical stock per frame per location |
| `inventory_adjustments` | `id` | Audit log of every stock change |
| `inventory_protections` | `id` | Holds, last-unit locks, display reserves |

All tables have a `synced_at` timestamp. The `shopify_updated_at` field tracks the last Shopify-side update.

---

## Troubleshooting

### Webhooks not arriving

- Check Shopify Admin → Settings → Notifications → Webhooks for delivery failures
- Verify `SHOPIFY_WEBHOOK_SECRET` matches the signing secret in Shopify
- Check that the webhook URL is correct and publicly accessible

### Customer data out of sync

- Run backfill: `node --env-file=.env.local scripts/backfill.mjs`
- Check `synced_at` timestamp on the customer projection
- Verify the webhook for `customers/update` is registered

### Storefront API errors

- Check `SHOPIFY_STOREFRONT_ACCESS_TOKEN` is valid
- Verify API scopes include the needed `unauthenticated_read_*` permissions
- Check rate limits (Storefront API: 100 requests/second)

### Admin API errors

- Check `SHOPIFY_ADMIN_API_ACCESS_TOKEN` is valid
- Verify API scopes include `write_customers` for CRM updates
- Check rate limits (Admin API: 40 requests/second, bucket-based)

### Customer login not working

- Verify Customer Account API credentials
- Check `NEXT_PUBLIC_APP_URL` matches the allowed redirect URL in Shopify
- Check browser cookies for auth tokens

---

## Security

- **Storefront token** is public (prefixed with `NEXT_PUBLIC_`) — safe for client-side
- **Admin token** is private — never exposed to the browser, server-side only
- **Webhook secret** verifies authenticity of incoming webhooks via HMAC-SHA256
- **Customer OAuth** uses PKCE flow with httpOnly cookies for token storage
- **All projection data** is a read cache — Shopify remains the source of truth
