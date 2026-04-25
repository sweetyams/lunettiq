# System Status

**Public page:** `/system/status`  
**CRM page:** `/crm/settings/system` (top section)  
**API:** `GET /api/system/status`

---

## What It Checks

Every check makes a real API call or DB query — no "key exists" shortcuts.

### Core

| Service | Check | What "ok" means |
|---|---|---|
| Neon Postgres | `SELECT count(*) FROM integrations_config` | DB connected, table exists |
| Clerk Auth | `GET /v1/users?limit=1` | Secret key valid, API reachable |
| Inngest | Signing key present OR dev server at `:8288` | Background jobs will process |
| Upstash Redis | `GET /ping` on REST endpoint | Cache available (optional) |

### Shopify

| Service | Check | What "ok" means |
|---|---|---|
| Storefront API | GraphQL `{ shop { name } }` | Public product queries work |
| Admin API | REST `GET /shop.json` | CRM write-through works |
| Webhooks | `GET /webhooks.json` + topic validation | Real-time sync active. Error if missing: `orders/create`, `orders/updated`, `products/update`, `customers/create`, `customers/update` |

### Square

| Service | Check | What "ok" means |
|---|---|---|
| POS | `GET /v2/locations` | Token valid, shows environment + location count |
| Webhooks | `GET /v2/webhooks/subscriptions` | Subscription exists with events registered |

### Services

| Service | Check | What "ok" means |
|---|---|---|
| Anthropic (Claude) | `POST /v1/messages` (1 token) | API key valid, AI features work |
| Klaviyo | `GET /api/accounts/` | Email integration connected |

### Tracking (key-exists only)

PostHog, Polar, GA4, Meta Pixel, TikTok, Pinterest, Snapchat — no server API to ping, checks if pixel ID/key is configured.

---

## Key Resolution

The status API reads `integrations_config` directly from the DB on every request (no module cache). For each key it checks:

1. DB row for the integration (if `enabled = true`) → `keys` JSON field
2. Environment variable fallback

This means keys set in CRM Settings → Integrations are picked up immediately.

---

## UI

### Public (`/system/status`)

Grouped into: Core, Shopify, Square, Services, Tracking. Green/red/gray dots. No auth required.

### CRM (`/crm/settings/system`)

Same groups at the top of the System Setup page, above the action buttons.

---

## Troubleshooting

| Status | Meaning | Fix |
|---|---|---|
| 🟢 ok | Service connected and responding | — |
| 🔴 error | Key exists but service returned an error | Check the detail message — usually invalid key or network issue |
| ⚪ off | No key configured | Set in CRM Settings → Integrations or as Vercel env var |
