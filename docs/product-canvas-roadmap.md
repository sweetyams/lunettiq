# Product Canvas — Feature Roadmap

The Product Canvas is an enhanced CRM product detail page that surfaces intelligence about how a product performs, who buys it, and what to do next. Based on the Senna Black mockup.

## Current State

The CRM product detail page (`/crm/products/[id]`) currently shows:
- Product images with variant filtering
- Title, vendor, price
- Variant table (image, title, SKU, price, inventory, availability)
- Specs card (metafields from Shopify: material, dimensions, etc.)
- Recommend to client flow (multi-variant → multi-client)

---

## Blocks to Add

### 1. AI Diagnosis (on-demand, like client AI Styler)

Contextual AI read on the product — identifies patterns, problems, opportunities.

**Data required:**
- `product_feedback` — sentiment counts (love/like/neutral/dislike) ✅ exists
- `product_interactions` — try-on counts, view counts ✅ exists
- `orders_projection.line_items` — purchase history ✅ exists
- `try_on_sessions` — session-level try data ✅ exists
- Return data — needs: return reason field on `orders_projection` line items or a dedicated returns table ❌ missing
- Purchase lag (days from first try-on to purchase) — derivable from `product_interactions` + `orders_projection` ✅ derivable

**Links to real data:**
- `product_feedback.sentiment` → love/neutral/dislike counts
- `product_interactions.interaction_type` → tried_on, viewed, purchased counts
- `orders_projection` → units sold, revenue

---

### 2. Product Funnel (Viewed → Tried → Loved → Purchased)

Four-step conversion funnel with rates and time-range toggles.

**Data required:**
- PDP views — `product_interactions` where `interaction_type = 'viewed'` ✅ exists (but needs storefront event tracking piped in)
- Try-ons — `product_interactions` where `interaction_type = 'tried_on'` ✅ exists
- Loved — `product_feedback` where `sentiment IN ('love', 'like')` ✅ exists
- Purchased — `product_interactions` where `interaction_type = 'purchased'` OR `orders_projection.line_items` ✅ exists
- Time-range filtering — all tables have `occurred_at` / `created_at` ✅ exists

**Missing:**
- Storefront view tracking → `product_interactions` with `source = 'storefront'` needs a storefront event hook
- Klaviyo click tracking → `product_interactions` with `source = 'klaviyo_click'` schema exists but no inbound sync

---

### 3. Velocity (weekly sales over 12 weeks)

Bar chart of units sold per week + 7d/30d/90d summaries.

**Data required:**
- `orders_projection.line_items` + `created_at` ✅ exists — group by week, count items matching product ID
- Compare periods — derivable from same data ✅

**No new data needed.** Can be built entirely from `orders_projection`.

---

### 4. Buyer Archetype (AI-derived)

AI-generated profile: typical age, face shape, tier, location, pair number, lens add-on.

**Data required:**
- Buyer demographics — `customers_projection.metafields.custom` (face_shape, birthday → age) ✅ exists
- Tier — `customers_projection.tags` (member-essential, member-cult, member-vault) ✅ exists
- Location — `orders_projection.shipping_address` or `interactions.location_id` ✅ exists
- Pair number — count of prior orders per customer before this purchase ✅ derivable
- Lens add-ons — `orders_projection.line_items` attributes (lens type from cart attributes) ⚠️ partially available (depends on line item attribute storage)

**Missing:**
- Age/birthday — stored in `metafields.custom.birthday` but not always populated
- Lens configuration per order — cart line attributes (`_lensType`, `_lensIndex`, `_coatings`) are in the Shopify order but may not be preserved in `line_items` JSONB

---

### 5. Hot Clients (who to reach out to)

AI-ranked list of clients who tried/loved but haven't purchased, with context.

**Data required:**
- `product_feedback` where `sentiment = 'love'` AND no matching purchase in `orders_projection` ✅ derivable
- Client LTV — `customers_projection.total_spent` ✅ exists
- Client tier — `customers_projection.tags` ✅ exists
- Last interaction date — `product_interactions.occurred_at` ✅ exists
- Interaction notes — `interactions.body` for context ✅ exists
- Purchase patterns — `orders_projection` for commit timing ✅ derivable

**No new data needed.** This is a query + AI ranking layer.

---

### 6. Head-to-Head (chosen over / lost to)

Which frames this product wins or loses against in try-on sessions.

**Data required:**
- `try_on_sessions` — which frames were tried in the same session ✅ exists (but `frames_tried` is just a count)
- `product_interactions` with `session_id` — links products to sessions ✅ exists
- Purchase outcome per session — `try_on_sessions.outcome_tag` + which product was purchased ⚠️ partially available

**Missing:**
- Need to track which specific product was purchased from a try-on session. Currently `outcome_tag` is `purchased | saved_for_later | no_match | needs_followup` but doesn't link to the purchased product ID.
- **Suggested schema addition:** `purchased_product_id TEXT` on `try_on_sessions`

---

### 7. Pairs Well With (2nd pair correlation)

Products commonly bought by the same customer.

**Data required:**
- `orders_projection` — all orders per customer, find product co-occurrence ✅ derivable
- No new data needed. Query: for customers who bought product X, what else did they buy?

---

### 8. Returns Analysis

Return reasons and rate breakdown.

**Data required:**
- Return status — `orders_projection.financial_status` = 'refunded' or 'partially_refunded' ✅ exists
- Return reason — ❌ **missing**. Shopify doesn't include return reasons in order webhooks by default.

**Suggested schema addition:** `return_reason TEXT` and `returned BOOLEAN` on line items within `orders_projection.line_items` JSONB, or a dedicated `returns` table:
```
returns (
  id UUID PK,
  shopify_order_id TEXT,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  shopify_customer_id TEXT,
  reason TEXT,  -- 'colour_off', 'too_heavy', 'fit_bridge', 'changed_mind', etc.
  notes TEXT,
  staff_id TEXT,
  returned_at TIMESTAMP
)
```

---

### 9. Sentiment Donut

Love/neutral/dislike breakdown from try-ons.

**Data required:**
- `product_feedback.sentiment` ✅ exists
- `product_feedback.try_on_count` ✅ exists
- Average try-on duration — ❌ **missing**. Would need `product_interactions` to track duration per try-on.

**Suggested:** Add `duration_seconds INTEGER` to `product_interactions` for try-on events.

---

### 10. Inventory by Location

Per-variant stock levels with hold status.

**Data required:**
- `product_variants_projection.inventory_quantity` ✅ exists (but aggregated, not per-location)
- `locations` table ✅ exists
- Per-location inventory — ❌ **missing**. Shopify has `InventoryLevel` per location but it's not synced.
- Holds — ❌ **missing**. No hold/reservation system exists.

**Suggested:**
- Sync Shopify `InventoryLevel` API into a new `inventory_levels` table
- Add a `holds` table: `(id, variant_id, customer_id, location_id, staff_id, expires_at, status)`

---

### 11. Margin / Economics

Retail price, COGS, margin %, LTV impact.

**Data required:**
- Retail price — `product_variants_projection.price` ✅ exists
- COGS — ❌ **missing**. Shopify has `inventory_item.cost` but it's not synced.
- Member pricing — derivable from tier discount rules in `loyalty-config` ✅ exists
- LTV impact (avg subsequent purchase after buying this product) — derivable from `orders_projection` ✅

**Suggested:** Add `cost TEXT` to `product_variants_projection` and sync from Shopify `InventoryItem` API.

---

### 12. Lens Attach Rate

What lens types are added when this frame is purchased.

**Data required:**
- Cart line attributes on orders — `_lensType`, `_lensIndex`, `_coatings` ⚠️ stored in `orders_projection.line_items` if Shopify preserves cart attributes on the order
- Needs verification of what's actually in the `line_items` JSONB

---

### 13. Second Sight Activity

Trade-in stats for this product.

**Data required:**
- `second_sight_intakes.current_frames` JSONB ✅ exists — needs to reference product IDs
- `second_sight_intakes.status`, `credit_amount` ✅ exists
- Resale data — ❌ **missing** (would need archive/resale tracking)

---

## Implementation Priority

| Priority | Block | New data needed? |
|----------|-------|-----------------|
| 1 | Velocity | No — `orders_projection` only |
| 2 | Sentiment donut | No — `product_feedback` only |
| 3 | Pairs well with | No — `orders_projection` co-occurrence |
| 4 | Hot clients | No — `product_feedback` + `orders_projection` + AI |
| 5 | Funnel | Partial — needs storefront view tracking |
| 6 | AI Diagnosis | No — wraps existing data with Claude |
| 7 | Buyer archetype | Partial — needs birthday/age data populated |
| 8 | Head-to-head | Partial — needs `purchased_product_id` on try-on sessions |
| 9 | Inventory by location | Yes — needs `inventory_levels` table + Shopify sync |
| 10 | Returns analysis | Yes — needs `returns` table |
| 11 | Margin | Yes — needs COGS/cost data |
| 12 | Lens attach rate | Verify — check `line_items` JSONB for cart attributes |
| 13 | Second Sight | Partial — needs product ID linkage in intake frames |

## Schema Additions Needed

```sql
-- Try-on session → purchased product link
ALTER TABLE try_on_sessions ADD COLUMN purchased_product_id TEXT;

-- Product interaction duration
ALTER TABLE product_interactions ADD COLUMN duration_seconds INTEGER;

-- Variant cost (COGS)
ALTER TABLE product_variants_projection ADD COLUMN cost DECIMAL(12,2);

-- Inventory by location
CREATE TABLE inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_variant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMP DEFAULT now(),
  UNIQUE(shopify_variant_id, location_id)
);

-- Holds / reservations
CREATE TABLE holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_variant_id TEXT NOT NULL,
  shopify_customer_id TEXT,
  location_id TEXT,
  staff_id TEXT,
  expires_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT now()
);

-- Returns
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id TEXT NOT NULL,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT,
  shopify_customer_id TEXT,
  reason TEXT,
  notes TEXT,
  staff_id TEXT,
  returned_at TIMESTAMP DEFAULT now()
);
```

---

# Segments Canvas — Feature Gaps

Based on the `lunettiq_segments_canvas.html` mockup. The segment detail panel is now implemented with real data for vitals, composition, members, and actions. Below are the gaps.

## Implemented (real data)
- Vitals grid (total LTV, avg LTV, 90d spend, median idle) — from `orders_projection` + `customers_projection`
- Composition by tier — from `customers_projection.tags`
- Composition by location — from `metafields.custom.home_location` or `default_address.city`
- Composition by LTV band — from `customers_projection.total_spent`
- Engagement (email consent, SMS consent) — from `customers_projection.accepts_marketing` / `sms_consent`
- Member list with avatar, name, email, LTV, link — from `customers_projection`
- Action rail (demo buttons for: draft campaign, sync Klaviyo, bulk tag, invite to fitting, export CSV, alert)

## Gaps — data missing

| Feature | What's needed | Status |
|---------|--------------|--------|
| AI Analyst hero (4 suggestion cards) | Existing AI suggest endpoint works but doesn't produce the structured card format from mockup (category, size, suggested action) | ⚠️ AI prompt needs rework |
| Segment overlap map | Need to evaluate multiple segments and compute intersection counts | ❌ No API — need `getSegmentMembers` for N segments + set intersection |
| Email open rates in composition | Klaviyo engagement data not synced inbound | ❌ Need Klaviyo metrics API integration |
| Try-on activity in composition | `product_interactions` + `try_on_sessions` per member | ✅ Data exists, not aggregated per segment |
| Segment trend (↑+3 wk) | Need historical member count snapshots | ❌ No `segment_snapshots` table |
| Sync status (synced to Klaviyo) | Need Klaviyo list sync tracking | ❌ No sync status table |
| View categories (Opportunity/Diagnostic/Lifecycle/Cluster) | Need `category` field on segments | ❌ Not in schema |
| Natural language segment builder ("describe a group in your own words") | Existing AI suggest could be adapted | ⚠️ Needs dedicated endpoint |
| Rx renewal due segment rule | Need Rx expiry date in customer metafields | ❌ `rx_on_file` exists but no expiry date |

## Schema additions needed

```sql
-- Segment category for view filtering
ALTER TABLE segments ADD COLUMN category TEXT DEFAULT 'manual';
-- Values: 'opportunity', 'diagnostic', 'lifecycle', 'cluster', 'product', 'manual'

-- Segment snapshots for trend tracking
CREATE TABLE segment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES segments(id),
  member_count INTEGER NOT NULL,
  total_ltv DECIMAL(12,2),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(segment_id, snapshot_date)
);

-- Klaviyo sync status
ALTER TABLE segments ADD COLUMN klaviyo_list_id TEXT;
ALTER TABLE segments ADD COLUMN last_synced_at TIMESTAMP;
```
