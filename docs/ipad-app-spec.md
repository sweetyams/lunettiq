# Lunettiq iPad App — Product & Client Recommendation Flow

**Version:** 1.0
**API Base:** `https://lunettiq.vercel.app`
**Auth:** Clerk Bearer token + `X-CRM-Surface: tablet`

---

## Overview

The iPad app provides three core flows for SAs working with clients in-store. Each flow combines client intelligence, product discovery, and recommendation capture into a single session.

---

## Flow 1: Client Lookup → Profile → Recommendations

### Step 1. Find the client

```
GET /api/crm/clients?q={search}&limit=10
```

- Fuzzy search by name, email, phone (pg_trgm)
- Returns: `{ data: Client[], meta: { total } }`
- SA types 2-3 characters → instant results

### Step 2. Load full client profile

```
GET /api/crm/clients/{id}
```

Returns everything the SA needs at a glance:

| Field | Source |
|---|---|
| Name, email, phone | `client` |
| Tier (essential/cult/vault) | `client.tags` → `member-*` |
| LTV + order count | `client.totalSpent`, `client.orderCount` |
| Face shape, frame width | `client.metafields.custom.face_shape`, `frame_width_mm` |
| Stated preferences (shapes, materials, colours, avoid) | `client.metafields.custom.preferences_json` |
| Derived preferences | `preferences` object |
| Recent orders (last 10) | `orders[]` |
| Recent interactions | `timeline[]` |
| Appointments | `appointments[]` |
| Second Sight history | `intakes[]` |

### Step 3. Get AI stylist read (optional)

```
POST /api/crm/clients/{id}/ai-styler
Body: { "context": "Client is looking for a second pair for work" }
```

Returns: `{ thought: "...", chips: ["Show titanium options", "Check Draper in silver", ...] }`

### Step 4. Get scored product suggestions

```
GET /api/crm/clients/{id}/suggestions?limit=12
```

Returns products ranked by:
- Staff recommendations (highest weight)
- New colourways of owned models
- Face shape match
- Stated + derived preference match
- Fit (frame width within tolerance)
- Price range alignment

Each result includes `matchReasons: string[]` for the SA to reference in conversation.

---

## Flow 2: Product Discovery → Client Fit Check

### Step 1. Browse / search products

```
GET /api/crm/products?q={search}&type=&vendor=&material=&rx=&tag=&limit=24
```

- Fuzzy search across title, vendor, tags
- Results ranked by similarity score
- Returns: variants, inventory, images, metafields (frame_width, material, etc.)

### Step 2. Get product detail

```
GET /api/crm/products/{id}
```

Returns:
- Full product data + all metafields (dimensions, material, Rx compatible, etc.)
- All variants with inventory quantities
- Image URLs

### Step 3. Get product analytics (optional)

```
GET /api/crm/products/{id}/analytics
```

Returns: purchase demographics, sentiment breakdown, try-on conversion rate, top buyer segments.

### Step 4. Check fit against client

Compare product `metafields.custom.frame_width` against client `metafields.custom.frame_width_mm`:

| Difference | Display |
|---|---|
| ≤ 2mm | ✓ Good fit |
| 3-4mm | ⚠ Slightly wider/narrower |
| > 4mm | ✗ May not fit well |

This is computed client-side on the iPad using data already fetched.

---

## Flow 3: Try-On Session → Capture → Recommend

### Step 1. Start a try-on session

```
POST /api/crm/clients/{id}/tryon-sessions
Body: { "locationId": "loc_plateau" }
```

Returns: `{ id: "session-uuid", ... }`

### Step 2. Log each frame tried

For each frame the client tries:

```
POST /api/crm/products/interactions
Body: {
  "customerId": "{client_id}",
  "productId": "{product_id}",
  "variantId": "{variant_id}",  // optional
  "type": "tried_on",
  "sessionId": "{session_id}",
  "metadata": { "notes": "Too wide at temples", "photo_url": "..." }
}
```

Valid interaction types: `viewed`, `tried_on`, `liked`, `disliked`, `saved`, `shared`, `recommended`

### Step 3. Capture photos

```
POST /api/crm/clients/{id}/photo
Content-Type: multipart/form-data
Body: file (JPEG/PNG from iPad camera)
```

Returns: `{ url: "https://cdn.shopify.com/..." }`

Photo is uploaded to Shopify Files API and URL stored. Link the URL to the session via the interaction metadata.

### Step 4. Record sentiment

```
POST /api/crm/products/interactions
Body: { "customerId": "...", "productId": "...", "type": "liked" }
```

or `"disliked"` — this updates the `product_feedback` table and influences future suggestions.

### Step 5. End session

```
POST /api/crm/tryon/sessions/{session_id}/end
Body: { "outcomeTag": "purchased" | "saved_for_later" | "no_match" | "needs_followup", "notes": "..." }
```

### Step 6. Recommend (save to client profile)

```
POST /api/crm/clients/{id}/recommend
Body: { "productId": "...", "productTitle": "Draper — Tortoise" }
```

This:
- Creates an `interaction` (type: `product_recommendation`)
- Creates a `product_interaction` (type: `recommended`)
- Upserts `product_feedback` (sentiment: `like`)
- Shows on the client's storefront account as "Recommended by your optician"

---

## Flow 4: Post-Session Follow-up

### Log a follow-up note

```
POST /api/crm/interactions
Body: {
  "shopifyCustomerId": "{id}",
  "type": "follow_up",
  "direction": "outbound",
  "subject": "Post-fitting follow-up",
  "body": "Loved the Draper in tortoise. Wants to think about it. Follow up in 3 days.",
  "metadata": { "shortlisted": ["product_id_1", "product_id_2"] }
}
```

### Book a follow-up appointment

```
POST /api/crm/appointments
Body: {
  "shopifyCustomerId": "{id}",
  "title": "Follow-up fitting",
  "startsAt": "2026-04-25T14:00:00-04:00",
  "endsAt": "2026-04-25T14:30:00-04:00",
  "locationId": "loc_plateau",
  "notes": "Wants to try Draper + Senna again"
}
```

---

## Data Model Summary (what the iPad reads/writes)

| Entity | Read | Write |
|---|---|---|
| Client profile | ✓ | ✓ (update prefs, fit, metafields) |
| Client timeline | ✓ | ✓ (log interactions) |
| Client photo | — | ✓ (upload) |
| Products | ✓ | — |
| Product interactions | — | ✓ (tried_on, liked, disliked, etc.) |
| Product feedback | — | ✓ (via interactions) |
| Suggestions | ✓ | — |
| Try-on sessions | ✓ | ✓ (create, end) |
| Recommendations | — | ✓ |
| Appointments | ✓ | ✓ (create) |
| AI Styler | — | ✓ (request) |
| Locations | ✓ | — |
| Credits/Points | ✓ | ✓ (issue) |
| Membership | ✓ | ✓ (upgrade/downgrade) |

---

## Permissions Required

| Action | Permission |
|---|---|
| View clients | `org:clients:read` |
| Update client | `org:clients:update` |
| View products | `org:products:read` |
| Recommend product | `org:products:recommend` |
| Log interactions | `org:interactions:create` |
| Start try-on | `org:clients:update` |
| View suggestions | `org:products:read` |
| AI Styler | `org:recs:read` |
| Manage credits | `org:credits:manage` |
| Manage appointments | `org:appointments:create` |
| Record product interaction | `org:recs:create` |

SA role (`sa`) has all of these except `org:credits:manage` (manager+ only).

---

## Offline Considerations (V2)

For V1, the iPad requires network connectivity. For V2:

- Cache last 50 viewed client profiles in local SQLite
- Cache full product catalogue (images lazy-loaded)
- Queue interactions/recommendations for sync when back online
- Show "offline" badge, disable AI features

---

## Screen Map (suggested)

```
[Login] → [Client Search] → [Client Profile]
                                    ├── [Suggestions Grid]
                                    ├── [AI Styler]
                                    ├── [Start Try-On Session]
                                    │       ├── [Camera Capture]
                                    │       ├── [Frame Notes]
                                    │       └── [End Session → Outcome]
                                    ├── [Recommend Product]
                                    └── [Book Appointment]

[Product Search] → [Product Detail]
                        ├── [Fit Check vs Client]
                        ├── [Analytics]
                        └── [Recommend to Client]
```
