---
inclusion: manual
description: Skill — Guide for Shopify ↔ CMS integration work, enforcing ownership boundaries.
---

# Skill: Shopify ↔ CMS Integration

Use this skill when working on features that bridge Shopify and the CMS.

## Ownership Boundaries (Non-Negotiable)

| Concern | Owner | Never Store In |
|---|---|---|
| Products, pricing, inventory, checkout | Shopify | CMS |
| Variants, cart, payments, fulfillment | Shopify | CMS |
| Flavours, ingredients, batches, stories | CMS | Shopify metafields |
| Launch events, editorial content | CMS | Shopify |
| Flavour archive status | CMS | Shopify product status |

A flavour's archive status is independent of its Shopify product status. An archived flavour can still have an active Shopify product (e.g. a returning seasonal).

## Integration Layer

All Shopify ↔ CMS integration happens in Next.js API routes. Never in UI components.

```
app/api/products/sync/route.ts    # Shopify sync endpoint
lib/shopify/                       # Shopify Storefront API client
```

## Linking Pattern: Flavour → Shopify Product

The CMS flavour stores a `shopifyProductId` reference. The relationship is one-to-many (one flavour can map to multiple Shopify products — e.g. pint, soft serve kit).

When linking:
1. The CMS stores only the Shopify product ID as a reference
2. Price, inventory, and variant data are always fetched live from Shopify
3. Never cache Shopify pricing in the CMS database

## Sync Pattern

```typescript
// POST /api/products/sync
// Pulls product data from Shopify Storefront API
// Updates local product records with Shopify metadata
// Does NOT overwrite CMS-owned fields (flavour, story, etc.)
```

Sync fields on products table:
- `syncStatus`: `'synced' | 'pending' | 'error'`
- `lastSyncedAt`: timestamp
- `syncError`: error message if failed

## What Goes Where

When building a feature, ask: "Who owns this data?"

- Need to display a price? → Fetch from Shopify at render time
- Need to show flavour story on a product page? → Fetch from CMS, join by `shopifyProductId`
- Need to update inventory? → Shopify admin API, never CMS
- Need to add a tasting note? → CMS only
- Need to create a new sellable item? → Create in Shopify first, then link in CMS

## Common Mistakes to Avoid

1. Storing Shopify prices in CMS fields
2. Using Shopify metafields for editorial content
3. Coupling CMS publish state to Shopify product visibility
4. Putting business logic in React components instead of API routes
5. Creating a separate Express server — all integration goes through Next.js API routes
6. Duplicating ingredient data across systems
