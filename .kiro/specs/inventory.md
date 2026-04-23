# Spec: Inventory Management

## Core Model

Inventory tracks at the **family + colour + location** level — the physical frame. Shopify variants and Square catalog items are projections from this canonical stock.

```
Physical frame: Astaire Pink @ Plateau = 12 units
  ↓ projects to
  Shopify: Astaire © Pink Opt → available: 12
  Shopify: Astaire © Pink Sun → available: 12
  Square:  Astaire Pink       → available: 12
```

When ANY channel sells one unit, ALL projections update.

## Data relationships

```
product_families (astaire)
  └─ product_family_members (product_id, colour: pink, type: optical|sun)
       └─ product_variants_projection (shopify_variant_id, inventoryQuantity)
       └─ product_mappings (square_catalog_id → shopify_product_id)

inventory_levels (family_id + colour + location_id)
  = canonical stock truth
  → projects to all linked Shopify variants
  → projects to all linked Square catalog items
```

## Schema

### `inventory_levels` — canonical stock per frame per location

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `family_id` | text FK → product_families | Frame model |
| `colour` | text | Frame colour (from family member) |
| `location_id` | text FK → locations | Physical location |
| `on_hand` | integer | Physical count |
| `committed` | integer | Reserved for open orders |
| `security_stock` | integer | Buffer (overridable, default from settings) |
| `available` | integer | Computed: `on_hand - committed - security_stock` |
| `low_stock_threshold` | integer | Override per-frame (null = use global) |
| `discontinued` | boolean | Sold out forever — no restock |
| `updated_at` | timestamp | |
| `synced_at` | timestamp | |

Unique: `(family_id, colour, location_id)`

### `inventory_adjustments` — audit log

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `family_id` | text | |
| `colour` | text | |
| `location_id` | text | |
| `quantity_change` | integer | +/- delta |
| `field` | text | `on_hand`, `committed`, `security_stock` |
| `reason` | enum | `sale`, `return`, `recount`, `damage`, `loss`, `transfer`, `received`, `manual`, `sync` |
| `reference_id` | text | Order ID, transfer ID |
| `reference_type` | text | `shopify_order`, `square_order`, `transfer`, `recount` |
| `staff_id` | text | |
| `note` | text | |
| `previous_value` | integer | |
| `new_value` | integer | |
| `created_at` | timestamp | |

## Sync guarantee: Shopify never has stale inventory

### The projection function

```typescript
async function projectToChannels(familyId: string, colour: string) {
  // 1. Sum available across all locations (or just shipping location for online)
  const levels = await getInventoryLevels(familyId, colour);
  const shippingLocationId = await getSetting('shipping_location_id');
  
  // Online available = shipping location available only
  const onlineAvailable = levels.find(l => l.locationId === shippingLocationId)?.available ?? 0;
  
  // 2. Find all Shopify variants for this family+colour
  const members = await getFamilyMembers(familyId, colour);
  // members: [{productId, type: 'optical'}, {productId, type: 'sun'}]
  
  for (const member of members) {
    const variants = await getVariants(member.productId);
    for (const variant of variants) {
      // 3. Push to Shopify: same available for ALL variants of same frame
      await shopifySetInventory(variant.shopifyVariantId, shippingLocationId, onlineAvailable);
    }
  }
  
  // 4. Find all Square catalog items for this family+colour
  const squareMappings = await getSquareMappings(members.map(m => m.productId));
  for (const mapping of squareMappings) {
    const squareLocationId = levels.find(l => l.locationId === mapping.locationId)?.squareLocationId;
    if (squareLocationId) {
      await squareSetInventory(mapping.squareCatalogId, squareLocationId, levels.find(l => l.locationId === mapping.locationId)?.available ?? 0);
    }
  }
}
```

### When projection runs

| Trigger | Source | Action |
|---|---|---|
| Shopify order created | Webhook → Inngest | `committed += quantity`, project |
| Shopify order fulfilled | Webhook → Inngest | `on_hand -= quantity`, `committed -= quantity`, project |
| Shopify order cancelled | Webhook → Inngest | `committed -= quantity`, project |
| Square sale completed | Webhook → Inngest | `on_hand -= quantity`, project |
| Square refund | Webhook → Inngest | `on_hand += quantity`, project |
| Manual adjustment | CRM API | Update level, project |
| Stock received | CRM API | `on_hand += quantity`, project |
| Recount | CRM API | Set `on_hand` to new value, project |
| Sync pull | CRM API | Reconcile from Shopify/Square, project |

### Sync flow

```
Sale happens on ANY channel
  → Webhook fires
  → Inngest function:
      1. Resolve family+colour from variant/catalog ID
      2. Update inventory_levels
      3. Log inventory_adjustment
      4. Call projectToChannels(familyId, colour)
      5. ALL Shopify variants updated
      6. ALL Square items updated
  → Shopify NEVER stale (within webhook latency ~2-5s)
```

## Resolving family+colour from a sale

### From Shopify order

```
Order line item → variantId
  → product_variants_projection → shopifyProductId
  → product_family_members → familyId + colour
```

### From Square order

```
Order line item → catalogObjectId
  → product_mappings → shopifyProductId
  → product_family_members → familyId + colour
```

### Fallback (no family)

Products not in a family track at variant level (legacy mode). The `inventory_levels` table uses `family_id = NULL, colour = NULL, variant_id = X` as a fallback.

Add optional column:
| `variant_id` | text | Fallback for non-family products |

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/crm/inventory?familyId=X` | Levels for all colours in a family |
| `GET` | `/api/crm/inventory?productId=X` | Levels resolved via family membership |
| `GET` | `/api/crm/inventory?locationId=X` | All levels at a location |
| `POST` | `/api/crm/inventory/adjust` | Manual adjustment (reason required) |
| `POST` | `/api/crm/inventory/recount` | Set absolute count (logs delta) |
| `POST` | `/api/crm/inventory/receive` | Stock received at location |
| `POST` | `/api/crm/inventory/sync` | Full pull from Shopify + Square |
| `GET` | `/api/crm/inventory/adjustments` | Audit history |
| `GET/PUT` | `/api/crm/inventory/settings` | Global config |

## CRM UI

### Product detail — Inventory section

Shows per-location levels for the canonical frame (family+colour), not per-variant.

```
Inventory: Astaire Pink
┌──────────┬────────┬───────────┬──────────┬──────────┐
│ Location │ On Hand│ Committed │ Security │ Available│
├──────────┼────────┼───────────┼──────────┼──────────┤
│ Plateau  │   12   │     2     │    2     │    8     │
│ DIX30    │    5   │     0     │    2     │    3     │
└──────────┴────────┴───────────┴──────────┴──────────┘
Total available: 11  |  Online (Plateau): 8

[Adjust]  [Receive Stock]  [Recount]  [Sync]
```

### Products list — Stock dots

On product cards:
- 🟢 In stock (available > threshold)
- 🟡 Low stock (0 < available ≤ threshold)
- 🔴 Out of stock (available = 0)
- ⚫ Discontinued

### Family detail — Colour inventory grid

On `/crm/products/families/[id]`:

```
┌─────────┬──────────┬──────────┬───────┐
│ Colour  │ Plateau  │ DIX30    │ Total │
├─────────┼──────────┼──────────┼───────┤
│ Pink    │    8     │    3     │   11  │
│ Black   │   15     │    7     │   22  │
│ Blue    │    0 🔴  │    2     │    2  │
└─────────┴──────────┴──────────┴───────┘
```

### Settings → Inventory

- Default security stock per location
- Shipping location (which location feeds Shopify online)
- Low stock threshold (global default)
- Sync controls + last sync timestamp

## Square integration changes

### New: Square inventory read

Add to `lib/square/client.ts`:
```typescript
export async function getInventoryCounts(catalogObjectIds: string[], locationIds: string[])
```

Uses Square `inventory/batch-retrieve-counts` endpoint.

### New: Square inventory write

**New file:** `lib/square/inventory-write.ts` (separate from read-only client per existing HARD RULE)

```typescript
export async function setInventoryCount(catalogObjectId: string, locationId: string, quantity: number)
```

Uses Square `inventory/changes/batch-create` endpoint. Every call logged to `inventory_adjustments`.

## Migration path

1. Schema: `inventory_levels` + `inventory_adjustments` tables
2. Service: `lib/crm/inventory.ts` — core logic (adjust, recount, receive, project)
3. Sync: Pull from Shopify inventory levels API
4. Sync: Pull from Square inventory counts API
5. API: CRUD endpoints
6. UI: Product detail inventory section
7. UI: Stock dots on product list
8. Push: Write available back to Shopify on every change
9. Push: Write available back to Square on every change
10. Webhooks: Handle order events → inventory updates → projection
11. UI: Family colour inventory grid
12. UI: Settings → Inventory page

## Hard requirements ✅

- Works with existing Shopify Admin GraphQL integration
- Works with existing Square integration (read exists, write = new module)
- Uses existing `locations` table with Shopify/Square location IDs
- Uses existing `product_families` + `product_family_members` for canonical frame model
- Uses existing `product_mappings` for Square → Shopify linking
- Shopify never has stale inventory (projection runs on every change)
- Full audit trail on every adjustment

## Implementation Status

| Step | Status | File(s) |
|---|---|---|
| Schema: `inventory_levels` + `inventory_adjustments` | ✅ | `lib/db/schema.ts` |
| Service: core inventory logic | ✅ | `lib/crm/inventory.ts` |
| Sync: pull from Shopify inventory levels | ✅ | `lib/crm/inventory-sync.ts` |
| Sync: pull from Square inventory counts | ⬜ | Needs `getInventoryCounts` on Square client |
| API: GET/POST `/api/crm/inventory` | ✅ | `app/api/crm/inventory/route.ts` |
| API: GET `/api/crm/inventory/adjustments` | ✅ | `app/api/crm/inventory/adjustments/route.ts` |
| API: POST `/api/crm/inventory/sync` | ✅ | `app/api/crm/inventory/sync/route.ts` |
| UI: Product detail inventory section | ✅ | `app/crm/products/[id]/ProductDetailClient.tsx` |
| UI: Stock dots on product list | ✅ | `app/crm/products/ProductsClient.tsx` |
| UI: Inventory page `/crm/inventory` | ✅ | `app/crm/inventory/page.tsx` |
| UI: Sidebar restructure (Products → Inventory) | ✅ | `components/crm/CrmSidebar.tsx` |
| System page: inventory sync action | ✅ | `app/crm/settings/system/page.tsx` |
| Push: write available to Shopify | ⬜ | Needs `inventorySetQuantities` mutation |
| Push: write available to Square | ⬜ | Needs `lib/square/inventory-write.ts` |
| Webhooks: order events → inventory updates | ⬜ | Needs Inngest handlers |
| UI: Family colour inventory grid | ⬜ | On family detail page |
| UI: Settings → Inventory page | ⬜ | Global config (security stock, shipping location) |

## Remaining Work

### Priority 1: Push to Shopify (keeps Shopify in sync)
- Add `inventorySetQuantities` mutation to `lib/shopify/admin-graphql.ts`
- Call from `projectToChannels()` after every adjustment
- Maps: `inventory_levels.available` → Shopify `available` quantity per variant per location

### Priority 2: Webhook handlers (real-time updates)
- `shopify/orders/create` → increment `committed`
- `shopify/orders/fulfilled` → decrement `on_hand` + `committed`
- `shopify/orders/cancelled` → decrement `committed`
- `square/order.completed` → decrement `on_hand`
- All handlers: resolve variant → family+colour → adjust → project

### Priority 3: Square inventory
- Read: add `getInventoryCounts()` to `lib/square/client.ts`
- Write: new `lib/square/inventory-write.ts` (separate from read-only client)
- Sync: add Square pull to `inventory-sync.ts`
- Push: call from `projectToChannels()`

### Priority 4: UI polish
- Family detail: colour × location inventory grid
- Settings → Inventory: default security stock, shipping location, low stock threshold
- Inventory page: adjustment history tab, bulk recount

### Not started (future)
- Transfer workflow between locations
- Canonical frame SKU (sun/optical share pool at DB constraint level)
- Demand forecasting
- Serialized tracking
- Automated low-stock alerts
