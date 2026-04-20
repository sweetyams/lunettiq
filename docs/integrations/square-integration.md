# Square POS Integration

**Status:** Live (sandbox)  
**Date:** 2026-04-18  
**Rule:** READ-ONLY — we only pull data from Square, never push changes.

---

## Overview

Square POS orders sync into the Lunettiq CRM automatically. When a sale happens at the register, the order appears in the CRM within seconds, matched to the customer's profile, with loyalty points issued.

```
Square POS → Webhook → /api/webhooks/square → Inngest → Database
                                                  ↓
                                          Customer matching
                                          Order projection
                                          Loyalty points
```

## What Syncs

| Square Data | Where It Goes | Notes |
|---|---|---|
| Completed orders | `orders_projection` (source: `square`) | Line items, totals, timestamps |
| Customer info | `customers_projection` | Matched by email/phone, or created as `sq_` prefix |
| Payment status | Order financial status | Only completed orders sync |
| Location | Mapped via `locations.square_location_id` | Set per-location in DB |

## What Does NOT Sync

- We never write to Square (no product updates, no customer changes, no order modifications)
- Draft/open orders are ignored — only COMPLETED state triggers sync
- Refunds are not yet tracked (future enhancement)

## Architecture

### Files

| File | Purpose |
|---|---|
| `src/lib/square/client.ts` | READ-ONLY API client |
| `src/app/api/webhooks/square/route.ts` | Webhook receiver + HMAC verification |
| `src/lib/inngest/functions.ts` | `syncSquareOrder` + `syncSquareCustomer` |
| `scripts/backfill-square.ts` | Historical order import |

### Customer Matching

When a Square order comes in with a customer:

1. Fetch customer from Square API (by `customer_id`)
2. Normalize email and phone
3. Look up in `customers_projection` by email, then phone
4. If found → link order to existing customer
5. If not found → create new entry with `sq_` prefix ID (e.g. `sq_ABC123`)

Shopify customers are never overwritten by Square data. Square-only customers (`sq_` prefix) can be updated.

### Location Mapping

Square locations are mapped to CRM locations via the `square_location_id` column:

| CRM Location | Square Location ID |
|---|---|
| Lunettiq - 2459 Notre-Dame O. | `L7S77JNHED7JH` |

To map a new location:
```sql
UPDATE locations SET square_location_id = 'LXXXXXXXXXX' WHERE id = 'loc_xxx';
```

---

## Environment Variables

```env
SQUARE_APPLICATION_ID=       # From Square Developer Dashboard
SQUARE_ACCESS_TOKEN=         # Sandbox or Production access token
SQUARE_WEBHOOK_SIGNATURE_KEY= # From webhook subscription setup
SQUARE_ENVIRONMENT=sandbox   # "sandbox" or "production"
SQUARE_WEBHOOK_URL=          # The registered webhook notification URL
```

---

## Moving to Production

### Step 1: Get Production Credentials

1. Go to [developer.squareup.com/apps](https://developer.squareup.com/apps)
2. Click your app → **Credentials** tab
3. Switch to **Production** tab
4. Copy the **Production Access Token**

### Step 2: Update Environment Variables

In your Vercel dashboard (or `.env.local` for local):

```env
SQUARE_ACCESS_TOKEN=<production-token>
SQUARE_ENVIRONMENT=production
SQUARE_WEBHOOK_URL=https://yourdomain.com/api/webhooks/square
```

### Step 3: Update Webhook URL

1. Square Developer Dashboard → Webhooks
2. Edit your subscription
3. Change URL to: `https://yourdomain.com/api/webhooks/square`
4. Save → copy the new Signature Key
5. Update `SQUARE_WEBHOOK_SIGNATURE_KEY` in Vercel env vars

### Step 4: Map Production Locations

Get your real Square location IDs:
```bash
curl -s -H "Authorization: Bearer <prod-token>" \
  "https://connect.squareup.com/v2/locations" | jq '.locations[] | {id, name}'
```

Then map each to your CRM locations:
```sql
UPDATE locations SET square_location_id = 'LREAL1' WHERE id = 'loc_lunettiq___2459_notre_dame_o_';
UPDATE locations SET square_location_id = 'LREAL2' WHERE id = 'loc_lunettiq___225_st_viateur_o_';
```

### Step 5: Backfill Historical Orders

```bash
# Pull all historical orders (adjust date as needed):
npx tsx scripts/backfill-square.ts --from 2023-01-01

# Or a specific range:
npx tsx scripts/backfill-square.ts --from 2024-06-01 --to 2025-01-01
```

The backfill is idempotent — safe to run multiple times. Orders are upserted by ID.

### Step 6: Verify

1. Make a test purchase at the POS
2. Check the CRM — order should appear within 10 seconds
3. Check the customer profile — order linked, points issued
4. Check `/crm/loyalty` dashboard — points balance updated

---

## Troubleshooting

### Webhook returns 401 (Invalid signature)

- `SQUARE_WEBHOOK_URL` must exactly match the URL registered in Square Dashboard
- `SQUARE_WEBHOOK_SIGNATURE_KEY` must match the key shown in Square Dashboard
- If using a tunnel (dev), the URL changes on restart — update both env and Square Dashboard

### Webhook returns 500

- Check that Inngest dev server is running: `npx inngest-cli@latest dev`
- Check Next.js terminal for error details

### Orders not appearing in DB

- Only COMPLETED orders sync (OPEN/CANCELLED are skipped)
- Check Inngest dashboard at `http://localhost:8288` for function run status
- Check if the order has a `sq_` prefix in `orders_projection`

### Customer not matched

- Customer must have email or phone in Square
- Email/phone must match exactly after normalization
- Unmatched customers get a `sq_` prefix ID — merge manually in CRM if needed

### Duplicate orders

- Orders use `sq_<order_id>` as primary key with `onConflictDoUpdate`
- Running backfill multiple times is safe
- Webhook retries are safe (same order ID = same row)

---

## Security

- **READ-ONLY**: The Square client (`src/lib/square/client.ts`) only uses GET requests. The search endpoint uses POST but it's a query, not a mutation.
- **HMAC verification**: Every webhook is verified against Square's signature before processing.
- **No PII in logs**: Webhook logging truncates payloads to 200 chars.
- **Access token**: Stored in environment variables, never in code.
- **Sandbox isolation**: Sandbox and production use different base URLs and tokens. `SQUARE_ENVIRONMENT` controls which is active.

---

## Future Enhancements

- [ ] Refund tracking (sync `refund.created` webhook)
- [ ] Inventory sync (read Square stock levels)
- [ ] Square customer → Shopify customer auto-merge
- [ ] CRM dashboard showing Square vs Shopify order split
- [ ] Square catalog mapping to Shopify products by SKU
