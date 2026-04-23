# Spec: Channel–Product Assignment Rules (UI: "Flows")

## Problem

Each configurator channel (Optical, Sun, Reglaze, etc.) needs to know which products it applies to. Currently there's no link between a flow and the product catalogue. The PDP needs to resolve which configurator to show for a given product.

## Design Principles

- Shopify is source of truth for product data (tags, productType, vendor)
- Rules live in our DB, not Shopify — no Shopify schema changes required
- Bulk assignment via tags/product type; manual overrides for edge cases
- First-match-wins evaluation with explicit priority ordering
- Cached resolution — don't query rules on every PDP hit

## Schema

### `channel_product_rules`

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `flow_id` | uuid FK → configurator_flows | Which channel this rule belongs to |
| `rule_type` | enum | `include_tag`, `exclude_tag`, `include_product_type`, `exclude_product_type`, `include_ids`, `exclude_ids` |
| `value` | text | Tag name, product type string, or comma-separated Shopify product IDs |
| `priority` | integer | Lower = evaluated first. Default 100. |
| `status` | enum (active/inactive) | |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### Enum: `channel_rule_type`

```
include_tag          — product has this tag → channel applies
exclude_tag          — product has this tag → channel does NOT apply
include_product_type — product type matches → channel applies
exclude_product_type — product type matches → channel does NOT apply
include_ids          — product ID in list → channel applies
exclude_ids          — product ID in list → channel does NOT apply
```

## Resolution Algorithm

```
resolveChannelForProduct(shopifyProductId) → Flow | null

1. Load product from products_projection (tags, productType)
2. Load all active channel_product_rules, grouped by flowId, sorted by priority ASC
3. For each channel (flow):
   a. Evaluate rules in priority order
   b. First matching include rule → mark channel as candidate
   c. Any matching exclude rule → remove from candidates
4. Return first candidate (by flow sort order), or null
5. Cache result in Upstash: key `cfg:channel:{productId}`, TTL 1 hour
6. Invalidate on product webhook (products/update, products/create)
```

### Evaluation Detail

For a rule to "match":
- `include_tag` / `exclude_tag`: product's `tags` array contains `value`
- `include_product_type` / `exclude_product_type`: product's `productType` equals `value` (case-insensitive)
- `include_ids` / `exclude_ids`: product's `shopifyProductId` is in comma-separated `value`

### Multiple Channels

A product can match multiple channels. Resolution returns all matching channels sorted by flow priority. The PDP can then:
- Show the first match as default
- Let the customer switch (e.g. "Configure as Optical" / "Configure as Sun" for dual-purpose frames)

## UI — Channels Page

Each channel card gets a "Product Rules" section:

```
┌─ Optical ──────────────────────────────────────┐
│  optical · active                               │
│                                                 │
│  PRODUCT RULES                                  │
│  1. Include where tag = rx-compatible           │
│  2. Exclude IDs: 123, 456                       │
│  + Add rule                                     │
│                                                 │
│  Matches: ~142 products                         │
└─────────────────────────────────────────────────┘
```

Rule form fields:
- Rule type (dropdown): include/exclude × tag/product type/specific products
- Value: text input for tag/type, or product search for IDs
- Priority: number (auto-incremented, draggable to reorder)

Optional: "Preview matches" button that runs the rules against `products_projection` and shows count + sample products.

## API

### `GET /api/crm/configurator/channel-rules?flowId=X`
Returns rules for a channel.

### `POST/PATCH/DELETE /api/crm/configurator/channel-rules`
CRUD for rules. Same pattern as other configurator entities.

### `GET /api/storefront/configurator/resolve?productId=X`
Public endpoint. Returns the resolved channel(s) for a product. Cached.

## Service Layer

### `lib/crm/configurator-resolve.ts`

```typescript
resolveChannelsForProduct(productId: string): Promise<Flow[]>
// 1. Check Upstash cache
// 2. Load product + rules
// 3. Evaluate
// 4. Cache result
// 5. Return matching flows
```

### Cache Invalidation

In `lib/inngest/functions.ts`, on `shopify/products/update`:
```typescript
await redis.del(`cfg:channel:${productId}`);
```

## Integration Points

| Where | What |
|---|---|
| PDP (`src/components/pdp/configurator/`) | Call `resolveChannelsForProduct()` to pick which flow to render |
| Channels page | CRUD UI for rules per channel |
| Product webhook (Inngest) | Cache invalidation |
| CRM product detail | Show which channel(s) a product is assigned to |

## Migration Path

1. Add `channel_product_rules` table + enum
2. Build rules CRUD on channels page
3. Build `resolveChannelsForProduct()` service
4. Wire into PDP (replace hardcoded channel logic)
5. Add cache layer
6. Add webhook invalidation

## Out of Scope (Future)

- Per-variant channel assignment (e.g. different configurator per colour)
- Channel priority ordering (for now, first match wins by flow creation order)
- Bulk rule import/export

## PDP Integration — Configurator Modal

### Replaces

The existing hardcoded configurator steps (`src/components/pdp/configurator/LensTypeStep.tsx`, `LensIndexStep.tsx`, `CoatingsStep.tsx`, `PrescriptionStep.tsx`, `ConfigSummary.tsx`, `RunningPriceTotal.tsx`) are replaced by a dynamic configurator modal driven by the flow builder data.

### Behaviour

- PDP page shows a "Configure Lenses" button (or similar CTA)
- Clicking opens a **modal overlay (50% width, right-aligned)** with the configurator
- Modal renders the resolved flow's steps/groups/choices dynamically
- Uses the same rule engine as the builder preview for conditions
- Running total shown in modal header
- On completion, adds configured line items to cart with `step.code.choice.code` attributes
- Modal can be closed and re-opened (state preserved)

### Data Flow

```
PDP loads → resolveChannelsForProduct(productId) → get flow
         → fetch flow steps/groups/choices/rules via API
         → render dynamic configurator modal
         → on complete → add to cart with configuration attributes
```

## Implementation Status

| Step | Status | File(s) |
|---|---|---|
| Schema: `channel_product_rules` table + `channel_rule_type` enum | ✅ | `lib/db/schema.ts` |
| Schema: `cubitts` added to `channel` enum | ✅ | `lib/db/schema.ts` |
| CRUD API: `channelRule` entity via `/api/crm/configurator` | ✅ | `app/api/crm/configurator/route.ts` |
| Facets API: distinct tags + product types | ✅ | `app/api/crm/products/facets/route.ts` |
| Resolve service: `resolveChannelsForProduct()` | ✅ | `lib/crm/configurator-resolve.ts` |
| Resolve endpoint: `GET /api/storefront/configurator/resolve` | ✅ | `app/api/storefront/configurator/resolve/route.ts` |
| Upstash cache: 1h TTL, lazy-loaded, integration-gated | ✅ | `lib/crm/configurator-resolve.ts` |
| Cache invalidation: product webhook in Inngest | ✅ | `lib/inngest/functions.ts` (sync-product) |
| Storefront APIs: dynamic channel support | ✅ | `app/api/storefront/product-options/route.ts`, `app/api/storefront/configure/route.ts` |
| CRM UI: Channels page with rules CRUD, drag-drop, tag cloud | ✅ | `app/crm/settings/product-options/channels/ChannelsClient.tsx` |
| CRM UI: Status badges (Draft/Published) | ✅ | `app/crm/settings/product-options/channels/ChannelsClient.tsx` |
| CRM Settings: Channels link on settings index | ✅ | `app/crm/settings/page.tsx` |
| Cubitts channel seed data | ✅ | `scripts/seed-cubitts-channel.ts` |
| Wire into PDP (replace hardcoded channel logic) | ⬜ | — |

## Requirements

| ID | Requirement | Status |
|---|---|---|
| REQ-CPR-001 | Rules evaluate include_tag, exclude_tag against product tags | ✅ |
| REQ-CPR-002 | Rules evaluate include_product_type, exclude_product_type (case-insensitive) | ✅ |
| REQ-CPR-003 | Rules evaluate include_ids, exclude_ids against comma-separated product IDs | ✅ |
| REQ-CPR-004 | Exclude rules override include rules for the same channel | ✅ |
| REQ-CPR-005 | Only published flows are resolved | ✅ |
| REQ-CPR-006 | Only active rules are evaluated | ✅ |
| REQ-CPR-007 | Results cached in Upstash with 1h TTL | ✅ |
| REQ-CPR-008 | Cache invalidated on product webhook | ✅ |
| REQ-CPR-009 | Product not found returns empty array | ✅ |
| REQ-CPR-010 | Multiple channels can match a single product | ✅ |
| REQ-CPR-011 | Rules ordered by priority (lower = first) | ✅ |
| REQ-CPR-012 | CRM UI: drag-drop reorder for rules | ✅ |
| REQ-CPR-013 | CRM UI: tag cloud picker from real product data | ✅ |
| REQ-CPR-014 | CRM UI: product type picker from real product data | ✅ |
| REQ-CPR-015 | Storefront APIs accept any channel string | ✅ |
