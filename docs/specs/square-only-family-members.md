# Square-Only Family Members — Technical Spec

## Problem

Some products exist only in Square (in-store POS) with no Shopify equivalent. Staff need to:
1. Add these to product families for complete sales tracking
2. See them in CRM family views alongside Shopify products
3. Later link a Shopify product when one is created

Example: "AINSLEY © PINK PRESCRIPTION" exists as 3 Square catalog items (different lens configs) but no Shopify product yet.

## Solution: Placeholder Products

Create a real `products_projection` row with a synthetic ID when adding a Square-only item to a family. This preserves all existing foreign key relationships and code paths.

## Data Model

### Placeholder Row in `products_projection`

| Column | Value |
|---|---|
| `shopify_product_id` | `sq__{square_catalog_id}` (e.g. `sq__ABCDEF123`) |
| `handle` | `null` |
| `slug` | Derived from family (e.g. `ainsley-pink`) |
| `title` | Square item name |
| `status` | `'placeholder'` |
| `vendor` | `null` |
| `images` | `null` |
| `tags` | `null` |
| All other columns | `null` / defaults |

### Why `sq__` prefix?
- Shopify product IDs are always numeric (e.g. `8978348671274`)
- `sq__` prefix guarantees no collision
- Easy to identify: `WHERE shopify_product_id LIKE 'sq__%'`

### No Schema Changes Required
- `products_projection.status` is `text` — accepts `'placeholder'`
- `product_family_members.product_id` stays `NOT NULL text` — references `sq__xxx`
- `product_mappings.shopify_product_id` is `text` — can store `sq__xxx`

## Flows

### Flow 1: Add Square Item to Family

```
Staff action: Families settings → select family → "Add Square Item"
             → search Square catalog → select item → set colour/type

System:
1. INSERT products_projection (shopify_product_id='sq__XXX', title=square_name, status='placeholder')
2. INSERT product_family_members (family_id, product_id='sq__XXX', type, colour)
3. INSERT product_mappings (square_catalog_id=XXX, shopify_product_id='sq__XXX', status='related')
4. regenerateFamilySlugs(familyId) → placeholder gets slug like 'ainsley-pink'
```

### Flow 2: Shopify Product Created Later (Merge)

```
Staff action: Square Mapping → link Square item to new Shopify product

System detects: product_mappings row exists with shopify_product_id='sq__XXX'
1. UPDATE product_family_members SET product_id = real_shopify_id WHERE product_id = 'sq__XXX'
2. UPDATE product_mappings SET shopify_product_id = real_shopify_id WHERE shopify_product_id = 'sq__XXX'
3. DELETE FROM products_projection WHERE shopify_product_id = 'sq__XXX'
4. regenerateFamilySlugs(familyId)

Result: family member now points to real product with images, variants, storefront link.
```

### Flow 3: Multiple Square Items → One Shopify Product

```
Example: "AINSLEY PINK PRESCRIPTION" has 3 Square items (single vision, progressive, bifocal)
         All 3 map to one Shopify product.

Only ONE placeholder is created (for the first Square item added to the family).
Additional Square items are linked via product_mappings with status='related'.
When Shopify product arrives, all 3 mappings update to the real ID.
```

### Flow 4: Remove Square Item from Family

```
Staff action: Family settings → remove member

System:
1. DELETE product_family_members WHERE product_id = 'sq__XXX'
2. DELETE products_projection WHERE shopify_product_id = 'sq__XXX'
3. DELETE product_mappings WHERE shopify_product_id = 'sq__XXX' (only the placeholder link)
4. regenerateFamilySlugs(familyId)
```

## Impact on Existing Code

### ✅ No Change Needed

| System | Why |
|---|---|
| `product_family_members` | `product_id` is text, accepts `sq__xxx` |
| `regenerateFamilySlugs` | JOINs `products_projection` — placeholder row exists, gets slug |
| `syncProduct` (webhook) | Only fires for Shopify products — never touches placeholders |
| `autoAssignProduct` | Only runs on Shopify webhook — never touches placeholders |
| Storefront family API | `WHERE p.status = 'active'` — placeholders filtered out |
| Storefront search API | `WHERE status = 'active'` — placeholders filtered out |
| Storefront product page | `resolveHandle` finds nothing for placeholder slugs → 404 (correct) |
| ProductCard / ProductGrid | Never receives placeholder data (APIs filter them) |
| Square auto-match | Matches by name — unaffected by placeholder existence |

### ⚠️ Changes Required

| System | Change |
|---|---|
| **Families settings UI** | Add "Add Square Item" button + Square catalog search |
| **Family detail UI** | Show placeholder members with "Square-only" badge, no product link |
| **FamiliesView** | Show placeholder members in expanded view with Square badge |
| **CRM products list** | Filter `status != 'placeholder'` (or show with badge) |
| **Product mapping confirm/link** | Detect placeholder, run merge flow |
| **Families API GET** | Include placeholder members in response |
| **`getFamilySales`** | Attribute Square sales to placeholder via `product_mappings` |
| **Family DELETE (member)** | Also delete placeholder row + mapping if `sq__` prefix |
| **Family DELETE (whole family)** | Also delete all placeholder rows + mappings |

## Stress Tests

### Test 1: Add Square item, then Shopify product arrives
1. Add "AINSLEY PINK" Square item to AINSLEY family as optical/pink
2. Verify: placeholder in `products_projection`, member in family, slug = `ainsley-pink`
3. Verify: storefront `/products/ainsley-pink` → 404 (correct, placeholder)
4. Create Shopify product, sync via webhook
5. Link in Square Mapping
6. Verify: placeholder deleted, family member points to real product
7. Verify: storefront `/products/ainsley-pink` → 200 (real product)
8. Verify: family switcher shows AINSLEY PINK with image

### Test 2: Multiple Square items for same product
1. Add "AINSLEY PINK SV" to family → creates placeholder
2. Add "AINSLEY PINK PROG" to family → should NOT create second placeholder
   (same colour+type, link via product_mappings as 'related')
3. Verify: one family member, two product_mappings rows
4. Link Shopify product → both mappings update

### Test 3: Remove Square item before Shopify product exists
1. Add Square item to family
2. Remove from family
3. Verify: placeholder deleted, mapping deleted, no orphans

### Test 4: Family with mix of Shopify and Square products
1. Family has 3 Shopify products + 2 Square-only
2. Storefront shows 3 colours (Shopify only)
3. CRM shows 5 colours (all)
4. Sales report aggregates all 5

### Test 5: Square item already mapped to different Shopify product
1. Square item "AINSLEY PINK SV" already mapped to "AINSLEY OPTICAL" (different product)
2. Adding to family should use existing mapping, not create placeholder
3. Family member points to the already-mapped Shopify product

### Test 6: Slug collision
1. Family "AINSLEY" has Shopify member colour=pink (slug: ainsley-pink)
2. Add Square item also colour=pink type=optical
3. Should detect existing member with same colour+type → reject or merge, not create duplicate

### Test 7: Concurrent webhook + CRM edit
1. Staff adds Square item to family (creates placeholder)
2. Simultaneously, Shopify webhook fires for a new product with matching handle
3. `autoAssignProduct` tries to add to same family
4. Verify: no duplicate members, merge happens cleanly

## Edge Cases

- **Square item name doesn't match family naming convention**: Staff manually sets colour/type — no parsing needed
- **Placeholder with no Square sales yet**: Shows in family with "0 sold" — correct
- **Shopify product deleted after merge**: Normal `deleteProduct` flow — removes from `products_projection`, family member becomes orphan. Existing behavior, not new.
- **Square catalog item deleted**: No webhook from Square. Placeholder persists until manually removed. Acceptable.

## Files to Modify

1. `src/app/crm/settings/families/page.tsx` — Add Square Item UI
2. `src/app/crm/products/families/[id]/FamilyDetailClient.tsx` — Placeholder badge
3. `src/app/crm/products/FamiliesView.tsx` — Placeholder in expanded view
4. `src/app/api/crm/settings/families/route.ts` — New action: `add-square-member`
5. `src/app/api/crm/settings/families/route.ts` — DELETE: cleanup placeholder
6. `src/app/crm/settings/product-mapping/page.tsx` — Merge flow on confirm/link
7. `src/lib/crm/product-sales.ts` — Attribute sales to placeholders
8. `src/app/crm/products/ProductsClient.tsx` — Filter or badge placeholders

## Auto-Creation from Unmatched Square Items

### Rule
When ≥4 unmatched Square catalog items share the same parsed frame name (e.g. "AIRE"), and no `product_families` row exists for that name, auto-create the family + placeholder members.

### Trigger
Runs as part of the existing "Auto-Match" button flow in Square Mapping (`/api/crm/system/auto-match-square`), after the normal matching pass.

### Logic

```
1. Group all unmatched Square items by parsed_frame (already extracted by auto-match)
2. For each group where count >= 4:
   a. Check: does product_families row exist for this frame name? → skip if yes
   b. Check: does any active Shopify product exist with this frame name? (`title ILIKE '{FRAME} %' AND status='active'`) → skip if yes (product exists on Shopify, should be matched normally not placeholdered)
   c. CREATE product_families (id=lowercase frame, name=UPPERCASE frame)
   c. For each item in group:
      - CREATE products_projection placeholder (sq__xxx, title=square_name, status='placeholder')
      - CREATE product_family_members (family_id, product_id=sq__xxx, type=parsed_type, colour=parsed_colour)
      - UPDATE product_mappings SET shopify_product_id='sq__xxx', status='related'
   d. regenerateFamilySlugs(familyId)
3. Return count of auto-created families in the auto-match result
```

### Why ≥4?
- Avoids creating families for one-off items or accessories
- A real eyewear family typically has ≥2 colours × ≥2 types (optical+sun) = 4+
- Configurable: store setting `auto_family_min_items` (default: 4)

### Deduplication Within Auto-Created Family
- Multiple Square items with same parsed colour+type (e.g. "AIRE BLACK SV" and "AIRE BLACK PROG") → one placeholder, multiple mappings
- First item creates the placeholder + family member
- Subsequent items with same colour+type just get a `product_mappings` row with `status='related'`

### UI Feedback
Auto-match result already shows `{ auto, familyOnly, unmatched, skipped }`. Add:
- `familiesCreated: number` — how many new families were auto-created
- `placeholdersCreated: number` — how many placeholder products

### Stress Tests (additions)

#### Test 8: Auto-create family from unmatched Square items
1. Import 6 Square items: AIRE BLACK OPT, AIRE BLACK SUN, AIRE GREY OPT, AIRE GREY SUN, AIRE BLUE OPT, AIRE BLUE SUN
2. Run auto-match → no Shopify matches
3. Verify: AIRE family created with 6 placeholders
4. Verify: slugs = aire-black, aire-black-sun, aire-grey, aire-grey-sun, etc.
5. Verify: storefront unaffected (placeholders filtered)

#### Test 9: Auto-create skips existing families
1. MARAIS family already exists with Shopify products
2. 5 unmatched Square items named "MARAIS ..."
3. Run auto-match → should NOT create duplicate MARAIS family
4. Should link Square items to existing family members via product_mappings

#### Test 10: Auto-create with <4 items
1. 3 unmatched Square items named "ZEPHYR ..."
2. Run auto-match → no family created (below threshold)
3. Items remain unmatched

#### Test 11: Mixed matched and unmatched
1. 6 Square items named "NOVA ...": 2 match Shopify products, 4 unmatched
2. Run auto-match → 2 get normal matches
3. Remaining 4 unmatched share name "NOVA" → family created
4. The 2 matched items are NOT added to the auto-created family (they follow normal mapping)
   Staff can manually add them later

### Files to Modify (additions)
9. `src/app/api/crm/system/auto-match-square/route.ts` — Auto-create pass after matching
10. `src/lib/crm/store-settings.ts` — Add `auto_family_min_items` default
