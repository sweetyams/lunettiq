# Integration Settings

**Page:** `/crm/settings/integrations`  
**Permission:** Owner only

---

## How It Works

Integration keys are stored in the `integrations_config` Postgres table, not environment variables. This lets owners configure integrations from the CRM UI without redeploying.

```
CRM Settings → Integrations → Toggle + Enter Keys
  ↓ saves to
integrations_config (id, enabled, keys jsonb)
  ↑ read by
getKey('KEY_NAME') → checks DB first, falls back to env var
```

### Key Resolution Order

1. **DB** (`integrations_config.keys` → JSON object with key-value pairs)
2. **Environment variable** (fallback for keys not in DB)

This means env vars work as defaults, and DB values override them.

### Enabling/Disabling

Each integration has an `enabled` boolean. Code checks this via `isIntegrationEnabled(id)`:

1. If DB row exists → uses `enabled` field
2. If no DB row → falls back to checking if the env var exists

### Cache

Integration configs are cached in memory for 60 seconds to avoid DB hits on every request. The cache is invalidated when settings are saved via the integrations page.

---

## Schema

```sql
integrations_config
  id             text PK        -- matches integration registry id
  enabled        boolean        -- toggle on/off
  keys           jsonb          -- { "KEY_NAME": "value", ... }
  configured_at  timestamptz    -- when keys were last set
  configured_by  text           -- staff user ID
  updated_at     timestamptz
```

---

## Registered Integrations

| ID | Name | Keys | Required |
|---|---|---|---|
| `shopify` | Shopify | `SHOPIFY_ADMIN_API_ACCESS_TOKEN`, `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET` | Core |
| `clerk` | Clerk Auth | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Core |
| `neon` | Neon Postgres | `DATABASE_URL` | Core |
| `inngest` | Inngest | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Core |
| `square` | Square POS | `SQUARE_ACCESS_TOKEN`, `SQUARE_APPLICATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY` | Optional |
| `anthropic` | Anthropic (Claude) | `ANTHROPIC_API_KEY` | Optional |
| `klaviyo` | Klaviyo | `KLAVIYO_API_KEY`, `KLAVIYO_PRIVATE_KEY` | Optional |
| `upstash` | Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional |
| `posthog` | PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Optional |
| `polar` | Polar Analytics | `NEXT_PUBLIC_POLAR_SITE_ID` | Optional |
| Pixels | Meta, TikTok, GA4, Pinterest, Snapchat | Various `NEXT_PUBLIC_*` IDs | Optional |

---

## Files

| File | Purpose |
|---|---|
| `src/lib/crm/integration-keys.ts` | `getKey(keyName)` — resolves key from DB or env |
| `src/lib/crm/integrations.ts` | `isIntegrationEnabled(id)`, `getIntegrationKey(id, keyName)`, cache |
| `src/lib/crm/integration-registry.ts` | Integration definitions (name, keys, setup steps) |
| `src/app/api/crm/settings/integrations/route.ts` | GET (list) + PATCH (save) API |
| `src/app/crm/settings/integrations/page.tsx` | Settings UI |
| `src/app/api/system/status/route.ts` | Health checks for all integrations |

---

## Adding a New Integration

1. Add entry to `INTEGRATIONS` array in `src/lib/crm/integration-registry.ts`
2. Add key mapping to `KEY_TO_INTEGRATION` in `src/lib/crm/integration-keys.ts`
3. Add env fallback to `ENV_CHECKS` in `src/lib/crm/integrations.ts`
4. Add status check to `src/app/api/system/status/route.ts`
5. Gate all integration code on `isIntegrationEnabled(id)` or `getKey()` returning non-null

---

## Security

- Keys are stored as **plain text** in the `keys` jsonb column (not encrypted at rest beyond Neon's disk encryption)
- Only **owners** can view or modify integration settings (enforced by `requireCrmAuth` + role check)
- Keys are never exposed to the browser — the GET endpoint returns `hasKey: true/false`, not the actual values
- The integrations page masks key inputs and only shows the first/last few characters
