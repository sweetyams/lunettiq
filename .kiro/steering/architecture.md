# Architecture Rules

## Integration Code Must Be Conditional

**HARD RULE:** All integration code MUST gate on integration being enabled. No load, execute, or bundle weight when disabled.

### Requirements:

1. Client-side pixels/scripts — render only when `/api/account/pixels` returns key AND `isIntegrationEnabled()` true
2. Server-side API calls — check `isIntegrationEnabled(id)` or `getKey()` before executing. Early return if disabled.
3. No hardcoded imports of integration SDKs at module level. Use dynamic `import()` so tree-shaking removes dead code.
4. No integration packages in critical bundle. Dynamic import only when enabled.
5. Webhook handlers — event fires regardless, Inngest function must early-return if integration disabled.

### Pattern:

```typescript
// ✅ Correct
export async function doThing() {
  const key = await getKey('SOME_INTEGRATION_KEY');
  if (!key) return;
  // ... integration logic
}

// ❌ Wrong
import { SomeSDK } from 'some-integration';
const client = new SomeSDK(process.env.SOME_KEY!);
```

### Applies to:
- Tracking pixels (PostHog, GA4, Meta, TikTok, Pinterest, Snapchat, Polar)
- Backend services (Klaviyo, Square, Anthropic)
- Infra (Inngest, Upstash) — exception: core, always loaded
- Auth (Clerk, Shopify OAuth) — exception: required

### Exceptions (always loaded):
- Shopify Storefront API (source of truth)
- Neon/Drizzle (DB)
- Clerk (staff auth)
- Next.js/Vercel (runtime)
