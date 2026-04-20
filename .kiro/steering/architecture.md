# Architecture Rules

## Integration Code Must Be Conditional

**HARD RULE:** All integration-specific code MUST be gated on the integration being enabled. No integration code should load, execute, or add bundle weight when the integration is disabled.

### Requirements:

1. **Client-side pixels/scripts** — only rendered when `/api/account/pixels` returns the key AND `isIntegrationEnabled()` is true
2. **Server-side API calls** — must check `isIntegrationEnabled(id)` or `getKey()` before executing. Return early / no-op if disabled.
3. **No hardcoded imports** of integration SDKs at module level. Use dynamic `import()` or conditional requires so tree-shaking removes dead code.
4. **No integration-specific packages** in the critical bundle. If an integration needs a client library (e.g., `posthog-js`), it must be dynamically imported only when enabled.
5. **Webhook handlers** — the event fires regardless, but the Inngest function must early-return if the integration is disabled.

### Pattern:

```typescript
// ✅ Correct — conditional on integration being enabled
export async function doThing() {
  const key = await getKey('SOME_INTEGRATION_KEY');
  if (!key) return; // no-op when not configured
  // ... integration logic
}

// ❌ Wrong — always imports/executes regardless of state
import { SomeSDK } from 'some-integration';
const client = new SomeSDK(process.env.SOME_KEY!);
```

### Applies to:
- Tracking pixels (PostHog, GA4, Meta, TikTok, Pinterest, Snapchat, Polar)
- Backend services (Klaviyo, Square, Anthropic)
- Infrastructure (Inngest, Upstash) — exception: these are core infra, always loaded
- Auth (Clerk, Shopify OAuth) — exception: required for app to function

### Exceptions:
- **Shopify Storefront API** — always required (source of truth)
- **Neon/Drizzle** — always required (database)
- **Clerk** — always required (staff auth)
- **Next.js/Vercel** — always required (runtime)
