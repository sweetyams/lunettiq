# iPad App — Product Detail Page Spec

## Purpose
Full product view with specs, inventory, fit check, and action buttons for recommending or logging interactions.

## Layout (bottom sheet or full page)
Two modes: **sheet** (70% height, from products grid) or **full page** (navigated directly).

### Top Section — Hero
- Image carousel (swipeable, full-width)
- Title + vendor
- Price (or price range)
- Variant selector (colour chips)

### Middle Section — Specs & Fit

**Dimensions table:**
| Spec | Value |
|---|---|
| Frame width | {frameWidth}mm |
| Lens width | {lensWidth}mm |
| Bridge | {bridgeWidth}mm |
| Temple | {templeLength}mm |
| Lens height | {lensHeight}mm |

**Material & details:**
- Material / Acetate source
- Hinge type
- Rx compatible: yes/no
- Origin

**Fit check (if client context active):**
- Compare product frame_width vs client frame_width_mm
- Display: "Good fit for {client name}" / "Runs 4mm wider than usual" / "Runs narrower"
- Visual bar showing client's ideal range vs this frame

### Bottom Section — Inventory & Variants

Table of variants:
| Colour | SKU | Stock | Price |
|---|---|---|---|
| Tortoise | LNQ-DRP-TRT | 3 | $395 |
| Black | LNQ-DRP-BLK | 0 | $395 |

### Analytics (collapsible)
- Times tried on (from product_interactions)
- Sentiment: X loved, Y liked, Z disliked
- Purchase conversion rate
- Top buyer segments

## API Calls

| Action | Endpoint |
|---|---|
| Load product | `GET /api/crm/products/{id}` |
| Analytics | `GET /api/crm/products/{id}/analytics` |

## Actions (bottom bar, sticky)

| Button | Action | Endpoint |
|---|---|---|
| "Recommend to {client}" | Save recommendation | `POST /api/crm/clients/{clientId}/recommend` |
| "Tried On" | Log try-on interaction | `POST /api/crm/products/interactions` with type `tried_on` |
| "Client Likes" | Log positive sentiment | `POST /api/crm/products/interactions` with type `liked` |
| "Not a Match" | Log negative sentiment | `POST /api/crm/products/interactions` with type `disliked` |
| "Add to Session" | Add to active try-on session | Local state + interaction log |

Buttons only visible when client context is active. Without client context, show "Select a client to recommend" prompt.

## Gestures
- Swipe images horizontally
- Pull down to dismiss (sheet mode)
- Double-tap image to zoom
