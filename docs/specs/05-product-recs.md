# Spec 05: Product Recommendations (Tier 1)

**Status:** APPROVED
**Dependencies:** Client profile (spec 03/04 already modified ClientProfileClient)
**Permissions used:** org:products:read, org:products:recommend

---

## What exists today

- Products grid at `/crm/products` with search/filter by type/vendor
- Product detail at `/crm/products/[id]` with "Recommend to Client" button → ClientPicker → creates interaction
- Recommend API at `/api/crm/clients/[id]/recommend` — creates interaction of type product_recommendation
- `preferences_derived` table with derived_shapes, derived_materials, derived_colours, derived_price_range
- `customers_projection.metafields` contains custom.face_shape, custom.frame_width_mm, custom.preferences_json
- `orders_projection` with line_items (products client has purchased)
- `products_projection` with tags, product_type, vendor, metafields

---

## What to build

### 1. Suggestions API

**File:** `src/app/api/crm/clients/[id]/suggestions/route.ts`

```
GET /api/crm/clients/[id]/suggestions?limit=10
Auth: org:products:read
Returns: [{ product, matchReasons[], score }]
```

Algorithm:
1. Load client: face_shape, frame_width_mm, preferences_derived, stated preferences (from metafields)
2. Load client's purchased product IDs from orders_projection line_items
3. Load all products from products_projection
4. Score each product:
   - +3 if product tags include client's face_shape
   - +2 if product tags include any stated preferred material
   - +2 if product tags include any stated preferred colour
   - +1 if product tags include any derived material/colour
   - +1 if price within derived_price_range
   - -100 if already purchased (exclude)
5. Sort by score desc, return top N with match reasons

### 2. ProductSearchModal

**File:** `src/components/crm/ProductSearchModal.tsx`

Modal for searching products to recommend. Used from client profile.

```
Props:
  open: boolean
  onClose: () => void
  onSelect: (product: { id: string; title: string }) => void

Behavior:
  - Search input (debounced, fetches GET /api/crm/clients?q=... — wait, that's clients)
  - Actually: search products via query params on products_projection
  - Need: GET /api/crm/products?q=X&limit=10 (lightweight search endpoint)
```

### 3. Products search API

**File:** `src/app/api/crm/products/route.ts`

```
GET /api/crm/products?q=X&type=Y&limit=10
Auth: org:products:read
Returns: [{ shopifyProductId, title, vendor, priceMin, imageUrl }]
```

### 4. ProductSuggestions component

**File:** `src/components/crm/ProductSuggestions.tsx`

Fetches from suggestions API. Shows product cards with match reasons.

```
Props:
  customerId: string

Renders:
  - "Suggested for this client" header
  - Grid of small product cards (image, title, price, match reason pills)
  - Click → opens product detail in new tab or recommends directly
```

### 5. Add to ClientProfileClient

In the left column (after Preferences card), add ProductSuggestions section.
Wire "Recommend Product" button in header to open ProductSearchModal.

---

## Done criteria

- [ ] Suggestions API returns scored products based on client preferences
- [ ] ProductSearchModal for searching/selecting products
- [ ] Products search API (lightweight)
- [ ] ProductSuggestions on client profile with match reasons
- [ ] "Recommend Product" button wired to ProductSearchModal
- [ ] Recommendation creates interaction via existing recommend API
- [ ] Already-purchased products excluded from suggestions
- [ ] TypeScript compiles clean

---

## Out of scope
- Virtual try-on (fast follow, separate spec)
- Likes/dislikes tracking (fast follow)
- Klaviyo event firing on recommendation (V2)
- AI stylist suggestions (V2, will use Claude)
