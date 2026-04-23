# Full Product Sync — Relationship Map

## What it does

`POST /api/crm/system/full-product-sync`

Pulls all products from Shopify Admin GraphQL API and updates the local projection. Also re-links CRM relationships when Shopify archives a product and creates a new one with the same handle.

## Tables updated directly

| Table | What | How |
|---|---|---|
| `products_projection` | Product data mirror | Upsert by `shopify_product_id` — title, handle, status, tags, images, metafields, prices |
| `product_variants_projection` | Variant data mirror | Upsert by `shopify_variant_id` — title, sku, price, inventory, image |

## Relationships re-linked (archived → active)

When Shopify archives a product and a new active product exists with the same handle, these tables are updated to point to the new product ID:

| Table | Column | Re-link logic |
|---|---|---|
| `product_family_members` | `product_id` | Match by handle, swap old→new. If new already exists in family, delete the old row. |
| `product_mappings` | `shopify_product_id` | Match by handle, swap old→new. |
| `product_filters` | `product_id` | Match by handle, swap old→new. |
| `product_colours` | `product_id` | Match by handle, swap old→new. |

## Metafield migration

CRM-owned metafields (e.g. `custom.product_category`) are copied from the archived product to the new active product if the new one doesn't have them set.

## Slug regeneration

After sync, all family slugs are regenerated via `regenerateAllSlugs()`. Non-family products get slugs derived from their handle via `toSlug()`.

## Tables NOT re-linked (by design)

| Table | Column | Why |
|---|---|---|
| `product_interactions` | `shopify_product_id` | Historical — interaction was with the old product |
| `product_feedback` | `shopify_product_id` | Historical — feedback was for the old product |
| `try_on_sessions` | `shopify_product_id` | Historical — try-on was with the old product |
| `configuration_snapshots` | `shopify_product_id` | Historical — config was for the old product |

## Filtering archived products

These APIs exclude archived products from results:

| API | Filter |
|---|---|
| `GET /api/crm/products` | Default `status=active`, supports `status=active,draft` or `status=all` |
| `GET /api/crm/settings/filters` | `WHERE p.status != 'archived'` on both assignments and unassigned |
| `ProductSearchModal` | Fetches with `status=active,draft` |
| All product search dropdowns | Fetch with `status=active,draft` |
