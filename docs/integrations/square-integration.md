# Square POS Integration

**Status:** Live (production credentials, webhooks pending registration)  
**Date:** 2026-04-25  
**Role:** In-store POS sales, customer data, inventory projection target

---

## Overview

Square POS orders sync into the Lunettiq CRM via webhooks. When a sale happens at the register, the order appears in the CRM within seconds, matched to the customer's profile, with loyalty points issued and inventory decremented. The CRM also pushes inventory levels back to Square so POS stock counts stay accurate.

```
Square POS
  ↓ webhooks (HMAC verified)
/api/webhooks/square
  ↓ events
Inngest
  ↓
Order projection + Customer matching + Inventory decrement + Loyalty points

CRM inventory changes
  ↓ projectToChannels()
Square inventory write (per-location available)
```

## What Syncs

### Square → CRM (via webhooks)

| Square Event | Inngest Function | What Happens |
|---|---|---|
| `order.created` | `syncSquareOrder` | Upsert order projection, match customer, issue loyalty points, decrement inventory |
| `order.updated` | `syncSquareOrder` | Update order projection |
| `payment.completed` | `syncSquareOrder` | Backup trigger (resolves order ID from payment) |
| `customer.created` | `syncSquareCustomer` | Upsert customer projection |
| `customer.updated` | `syncSquareCustomer` | Update customer projection |

### CRM → Square (via API writes)

| CRM Action | Square API Call | File |
|---|---|---|
| Inventory projection | `inventory/changes/batch-create` | `lib/square/inventory-write.ts` |

Inventory pushes happen automatically via `projectToChannels()` after every stock adjustment. Each CRM location with a `square_location_id` gets its own available count pushed.

## Architecture

### Files

| File | Purpose |
|---|---|
| `src/lib/square/client.ts` | READ-ONLY API client (orders, customers, locations, inventory counts) |
| `src/lib/square/inventory-write.ts` | Inventory write client (separate from read-only per architecture rule) |
| `src/app/api/webhooks/square/route.ts` | Webhook receiver + HMAC verification |
| `src/lib/inngest/functions.ts` | `syncSquareOrder` + `syncSquareCustomer` |
| `scripts/backfill-square.ts` | Historical order import |
| `scripts/register-square-webhooks.mjs` | Register webhook subscription |

### Customer Matching

When a Square order comes in with a customer:

1. Fetch customer from Square API (by `customer_id`)
2. Normalize email and phone
3. Look up in `customers_projection` by email, then phone
4. If found → link order to existing customer
5. If not found → create new entry with `sq_` prefix ID

### Location Mapping

Square locations are mapped to CRM locations via `locations.square_location_id`. Managed in Settings → Locations — unlinked Square locations appear automatically for linking.

### Inventory Flow

```
Square POS sale (order.created webhook)
  → syncSquareOrder resolves each line item:
    catalog_object_id → product_mappings → product_family_members → family + colour
  → adjust(on_hand, -qty, 'sale') at the sale location
  → projectToChannels() → pushes updated available to Square + Shopify
```

---

## Webhook Setup

### Prerequisites

- App deployed to Vercel (Square validates URL is reachable)
- `SQUARE_ACCESS_TOKEN` set (production or sandbox)
- `SQUARE_ENVIRONMENT` set (`production` or `sandbox`)

### Register

```bash
# Uses SQUARE_WEBHOOK_URL from env, or defaults to lunettiq.vercel.app:
node --env-file=.env.local scripts/register-square-webhooks.mjs

# Custom URL:
node --env-file=.env.local scripts/register-square-webhooks.mjs https://yourdomain.com/api/webhooks/square
```

The script registers one subscription with these events:
- `order.created`
- `order.updated`
- `payment.completed`
- `customer.created`
- `customer.updated`

**Save the signature key** returned by the script as `SQUARE_WEBHOOK_SIGNATURE_KEY` in your env vars.

### Verification

Every webhook is HMAC-verified using `SQUARE_WEBHOOK_SIGNATURE_KEY`. The HMAC is computed over `notification_url + body`. Invalid signatures return 401.

---

## Environment Variables

```env
SQUARE_APPLICATION_ID=       # From Square Developer Dashboard
SQUARE_ACCESS_TOKEN=         # Sandbox or Production access token
SQUARE_WEBHOOK_SIGNATURE_KEY= # From webhook subscription registration
SQUARE_ENVIRONMENT=sandbox   # "sandbox" or "production"
SQUARE_WEBHOOK_URL=          # The registered webhook notification URL
```

---

## Moving to Production

### Step 1: Get Production Credentials

1. [developer.squareup.com/apps](https://developer.squareup.com/apps) → your app → Credentials → Production
2. Copy the Production Access Token

### Step 2: Update Environment Variables

```env
SQUARE_ACCESS_TOKEN=<production-token>
SQUARE_ENVIRONMENT=production
SQUARE_WEBHOOK_URL=https://yourdomain.com/api/webhooks/square
```

### Step 3: Register Webhooks

```bash
node --env-file=.env.local scripts/register-square-webhooks.mjs
```

Save the returned signature key as `SQUARE_WEBHOOK_SIGNATURE_KEY`.

### Step 4: Map Locations

In Settings → Locations, unlinked Square locations appear automatically. Click "Link to existing" or "Create Location" for each.

### Step 5: Backfill Historical Orders

```bash
npx tsx scripts/backfill-square.ts --from 2023-01-01
```

### Step 6: Verify

1. Make a test purchase at the POS
2. Check CRM — order should appear within 10 seconds
3. Check customer profile — order linked, points issued
4. Check inventory — stock decremented at the sale location

---

## Troubleshooting

### Webhooks not registered

- Square validates the URL is reachable at registration time
- The webhook route must respond to GET with 200 (added in `route.ts`)
- Deploy to Vercel first, then run the registration script

### Webhook returns 401

- `SQUARE_WEBHOOK_URL` must exactly match the registered notification URL
- `SQUARE_WEBHOOK_SIGNATURE_KEY` must match the key from registration
- Tunnel URLs expire — re-register if using a tunnel

### Orders not syncing

- Only COMPLETED orders sync (OPEN/CANCELLED are skipped)
- Check Inngest dashboard for function run status
- Verify the Square location is mapped to a CRM location

### Inventory not pushing to Square

- Check `isIntegrationEnabled('square')` — Square must be enabled
- Check `locations.square_location_id` is set for the location
- Check `product_mappings` has a confirmed mapping for the product
- Check Inngest logs for `[inventory] Square push failed` errors

---

## Security

- **Inventory writes** go through a separate module (`inventory-write.ts`), not the read-only client
- **HMAC verification** on every webhook using Square's signature
- **No PII in logs** — webhook payloads truncated to 200 chars
- **Access token** in env vars, never in code
- **Environment isolation** — sandbox and production use different base URLs and tokens
