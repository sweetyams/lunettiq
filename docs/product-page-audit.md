# Product Page Audit — What's Wired vs What's Missing

**Date:** 2026-04-18

---

## Storefront PDP (`/products/[handle]`)

### ✅ Wired & Working

| Feature | Status | Notes |
|---|---|---|
| Image gallery | ✅ | Variant-aware, colour filtering |
| Colour selector | ✅ | URL-synced, variant matching |
| Lens configurator | ✅ | Full flow: type → index → coatings → prescription → summary |
| Add to cart | ✅ | Config-gated, serializes lens config as cart attributes |
| Dual-price display | ✅ | Shows full price, points price, CULT member price |
| Early access badge | ✅ | Shows on products tagged `early-access-*` |
| Product details accordion | ✅ | Material, hinge, lens coating, UV, warranty, origin |
| Dimensions accordion | ✅ | Frame width, lens width/height, bridge, temple |
| Shipping accordion | ✅ | + member shipping benefit note |
| Care accordion | ✅ | + Second Sight trade-in note |
| On-faces section | ✅ | Lifestyle images from metafields |
| Recommendations | ✅ | Shopify product recommendations below fold |
| Eye test CTA | ✅ | Metaobject-driven CTA block |
| Virtual try-on | ✅ | Face tracking via MediaPipe, triggered from gallery |
| Breadcrumbs | ✅ | Collection → Product |

### ⚠ Partially Wired

| Feature | Status | What's Missing |
|---|---|---|
| Points redemption at checkout | ⚠ | API exists (`/api/account/points`), but not wired into Shopify checkout. Needs: Shopify checkout extension or draft order discount application |
| Wishlist button | ⚠ | `WishlistContext` exists, `FavouriteIcon` component exists, but not visible on PDP. Needs: add `FavouriteIcon` next to product title |
| Member-only pricing | ⚠ | DualPriceDisplay shows the price, but actual checkout discount isn't applied. Needs: Shopify discount function or checkout script |
| Engraving milestone | ⚠ | `hasEngraving()` helper exists but not shown on PDP. Needs: "Free engraving available" badge for eligible customers |

### ❌ Not Built

| Feature | What's Needed | Complexity |
|---|---|---|
| **Checkout points redemption** | Shopify Checkout Extension (Functions API) to apply points as a discount. Or: create draft order with discount before redirect. | High — requires Shopify app extension |
| **Member pricing at checkout** | Shopify Discount Function that checks customer tags for tier and applies member pricing. Or: automatic discount based on `member-*` tags. | High — requires Shopify app extension |
| **Product reviews** | No review system. Options: Judge.me, Yotpo, or custom. Points earning (100pts per photo review) is ready in the loyalty system. | Medium — third-party integration |
| **Stock notifications** | "Notify me when back in stock" for out-of-stock variants. Needs: email capture + Klaviyo flow. | Low |
| **Size guide** | Frame dimensions are shown but no visual size guide or face-shape recommendation. | Low — content + UI |
| **Recently viewed** | No recently viewed products tracking. Needs: localStorage or cookie-based tracking. | Low |

---

## CRM Product Detail (`/crm/products/[id]`)

### ✅ Wired & Working

| Feature | Status |
|---|---|
| Product info (title, vendor, type, price) | ✅ |
| Image gallery with variant filtering | ✅ |
| Variant table (title, SKU, price, inventory, availability) | ✅ |
| Recommend to client (with variant picker) | ✅ |
| Client feedback (like/dislike from product page) | ✅ |
| Client context from query param (`?client=`) | ✅ |
| Product tags display | ✅ |
| Metafield display (material, dimensions, etc.) | ✅ |

### ❌ Not Built (CRM side)

| Feature | What's Needed |
|---|---|
| **Sales analytics** | `/api/crm/products/[id]/analytics` exists but could show: units sold, revenue, top customers, sell-through rate |
| **Inventory alerts** | Low stock warnings per variant |
| **Price history** | Track price changes over time |
| **Competitor pricing** | Manual field for competitor price comparison |

---

## Collection Page (`/collections/[handle]`)

### ✅ Wired

| Feature | Status |
|---|---|
| Product grid | ✅ |
| Filter bar (shape, colour, material, size) | ✅ |
| Sort (relevance, price, newest) | ✅ |
| Infinite scroll | ✅ |
| Early access gating | ✅ — filters by customer tier |
| Editorial panels | ✅ |

---

## What's Needed to Complete Checkout Integration

The biggest gap is **applying loyalty benefits at actual checkout**. Currently:
- DualPriceDisplay shows the member price and points price on PDP ✅
- Points redemption API exists ✅
- But Shopify checkout doesn't know about any of this ❌

### Options:

**Option A: Shopify Functions (recommended)**
- Build a Shopify Discount Function that:
  1. Reads customer tags (`member-essential`, `member-cult`, `member-vault`)
  2. Applies tier-appropriate pricing
  3. Reads a cart attribute for points redemption amount
  4. Applies points as a line discount
- Requires: Shopify CLI, Shopify Partners account, app deployment
- Complexity: High but correct

**Option B: Draft Order Approach**
- Before checkout, create a Shopify draft order with discounts pre-applied
- Redirect customer to draft order checkout URL
- Simpler but less seamless (breaks standard cart flow)

**Option C: Checkout UI Extension**
- Add a points redemption widget directly in Shopify checkout
- Requires: Shopify Checkout Extension API
- Best UX but highest complexity

### Recommendation
Start with **Option A** (Shopify Functions) for member pricing — it's automatic and invisible. Add **Option C** (Checkout Extension) for points redemption as a Phase 2 enhancement.
