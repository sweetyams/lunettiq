# Shopify Product Status Badge — Location Map

## Badge Spec

Every Shopify product displayed in the CRM shows a status badge:

| Status | Background | Text | Hex BG | Hex Text |
|---|---|---|---|---|
| active | Green | `#065f46` | `#d1fae5` | `#065f46` |
| draft | Yellow | `#92400e` | `#fef3c7` | `#92400e` |
| archived | Gray | `#6b7280` | `#f3f4f6` | `#6b7280` |

Badge style: `fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 600`

## All locations

### Product lists and grids

| Location | File | Data source | Status field |
|---|---|---|---|
| `/crm/products` grid cards | `ProductsClient.tsx` | `GET /api/crm/products` (Drizzle) | `p.status` |
| `/crm/products/[id]` detail header | `ProductDetailClient.tsx` | Page props from `products_projection` | `product.status` |
| `/crm/products` families view | `FamiliesView.tsx` | `GET /api/crm/products/families` (raw SQL) | `p.product_status` |
| `/crm/products/families/[id]` members | `FamilyDetailClient.tsx` | `getFamilySales()` → `product_status` | `m.productStatus` |

### Settings pages — product rows

| Location | File | Data source | Status field |
|---|---|---|---|
| Settings → Families member rows | `settings/families/page.tsx` | `GET /api/crm/settings/families` (raw SQL) | `m.status` |
| Settings → Families unassigned rows | `settings/families/page.tsx` | Same API, unassigned array | `p.status` |
| Settings → Filters assignment rows | `settings/filters/page.tsx` | `GET /api/crm/settings/filters` (raw SQL) | `a.product_status` |
| Settings → Filters unassigned rows | `settings/filters/page.tsx` | Same API, unassigned array | `p.status` |
| Settings → Square Mapping table | `settings/product-mapping/page.tsx` | `GET /api/crm/product-mappings` (raw SQL) | `m.shopify_status` |

### Product search/select dropdowns

| Location | File | Data source | Status field |
|---|---|---|---|
| `ProductSearchModal` (shared) | `components/crm/ProductSearchModal.tsx` | `GET /api/crm/products` (Drizzle) | `p.status` |
| Settings → Families add product | `settings/families/page.tsx` | `GET /api/crm/products` (Drizzle) | `p.status` |
| Family Detail add product | `FamilyDetailClient.tsx` | `GET /api/crm/products` (Drizzle) | `p.status` |
| Settings → Mapping product picker | `settings/product-mapping/page.tsx` | `GET /api/crm/products` (Drizzle) | `p.status` |

### Intentionally excluded

| Location | File | Why |
|---|---|---|
| Orders line items | `orders/[id]/page.tsx` | Shows order status, not product status |
| Client Canvas orders | `clients/[id]/ClientCanvas.tsx` | Shows order/interaction context, not product catalogue |
| Configurator choices | `FlowPanels.tsx` | Shows configurator choices, not Shopify products |
| Configurator preview | `LiveConfiguratorPreview.tsx` | Test preview, not product catalogue |

## Data flow

```
Shopify → webhook → Inngest (sync-product) → products_projection.status
                                            ↓
Full Product Sync (manual) ────────────────→ products_projection.status
                                            ↓
GET /api/crm/products ──→ Drizzle ORM ──→ { status: 'active' }  (camelCase)
Raw SQL queries ────────→ SQL result ───→ { product_status: 'active' }  (snake_case alias)
```
