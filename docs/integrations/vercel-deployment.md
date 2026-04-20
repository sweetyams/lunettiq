# Vercel — Deployment

**Purpose:** Hosts the Next.js application (storefront + CRM).

## Setup

1. Connect your GitHub repo to Vercel at [vercel.com/new](https://vercel.com/new)
2. Framework: Next.js (auto-detected)
3. Build command: `npm run build`
4. Install command: `npm install --legacy-peer-deps`

## Environment Variables

Set ALL of these in Vercel → Settings → Environment Variables:

```env
# Shopify
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=
SHOPIFY_STOREFRONT_ACCESS_TOKEN=
SHOPIFY_ADMIN_API_ACCESS_TOKEN=
SHOPIFY_WEBHOOK_SECRET=
SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID=
SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET=

# Square (READ-ONLY)
SQUARE_APPLICATION_ID=
SQUARE_ACCESS_TOKEN=
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_ENVIRONMENT=production
SQUARE_WEBHOOK_URL=https://yourdomain.com/api/webhooks/square

# Database
DATABASE_URL=

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Background Jobs
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Email
KLAVIYO_PRIVATE_KEY=
DISABLE_EXTERNAL_COMMS=false

# AI
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
REVALIDATION_SECRET=
```

## Post-Deploy Checklist

1. **Register Shopify webhooks:**
   ```bash
   node --env-file=.env.local scripts/register-webhooks.mjs https://yourdomain.com/api/webhooks/shopify
   ```

2. **Update Square webhook URL** in Square Developer Dashboard

3. **Backfill data:**
   ```bash
   node --env-file=.env.local scripts/backfill.mjs
   npx tsx scripts/backfill-square.ts
   npx tsx scripts/seed-loyalty-tiers-v2.ts
   npx tsx scripts/seed-appointment-types.ts
   ```

4. **Verify webhooks** — create a test customer/order in Shopify, check CRM

5. **Configure Clerk** — set production keys, add staff users with roles

6. **Configure Klaviyo** — create flows for all event types, set `DISABLE_EXTERNAL_COMMS=false`

## Custom Domain

1. Vercel → Settings → Domains → Add your domain
2. Update DNS records as instructed
3. Update `NEXT_PUBLIC_APP_URL` to your domain
4. Update `SQUARE_WEBHOOK_URL` to your domain
5. Update Shopify webhook URLs
6. Update Clerk allowed origins

## Preview Deployments

Every PR gets a preview URL. Preview deployments use the same env vars as production by default — use Vercel's environment variable scoping (Preview vs Production) to use separate credentials if needed.
