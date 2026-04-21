# Square-Only Family Members

## Overview

Products that exist only in Square (in-store POS) can be added to product families before a Shopify product is created. This enables complete sales tracking and family management across both channels.

## How It Works

When a Square-only item is added to a family, the system creates a **placeholder product** — a lightweight row in the products database with a synthetic ID (`sq__` prefix). This placeholder:

- Participates in family sales aggregation
- Shows in CRM family views with a **SQUARE** badge
- Is invisible on the storefront (filtered by status)
- Auto-merges when a real Shopify product is later linked

## Adding Square Items Manually

1. Navigate to **Settings → Families**
2. Select a family from the left sidebar
3. Click the amber **+ Square** button (next to + Shopify)
4. Search for the Square catalog item by name
5. Click to add — the system auto-detects colour and type from the item name

The item appears in the family member list with an amber ■ icon and SQUARE badge.

### Deduplication

If a family already has a member with the same colour and type, the Square item is linked via product mapping instead of creating a duplicate member.

## Auto-Creation from Unmatched Items

When running **Auto-Match** in Settings → Product Mapping, the system performs a second pass:

1. Groups all unmatched Square items by parsed frame name
2. For groups with **≥4 items** (configurable in Store Config → `auto_family_min_items`):
   - Checks no existing family or active Shopify product shares the name
   - Creates the family and placeholder members
   - Links all Square items via product mappings

The auto-match result banner shows how many families and placeholders were created.

## Merging with Shopify Products

When a Shopify product is created for a previously Square-only item:

1. The product syncs via webhook automatically
2. Go to **Settings → Product Mapping**
3. Find the Square item and link it to the new Shopify product
4. The system automatically:
   - Moves the family member from the placeholder to the real product
   - Updates all related product mappings
   - Deletes the placeholder
   - Regenerates family URL slugs

The product now appears on the storefront with images, in the family colour/type switcher.

## Removing Square Items

- **Remove from family**: Settings → Families → select member → ✕. Deletes the placeholder and all associated mappings.
- **Delete entire family**: Removes all placeholders and mappings for that family.

## Where Placeholders Appear

| Location | Visible? | Display |
|---|---|---|
| CRM Family Detail | ✅ | Amber ■ icon, SQUARE badge, sales data |
| CRM Families View (expanded) | ✅ | SQ badge on colour label |
| CRM Products List | ❌ | Filtered out (status = placeholder) |
| Storefront PDP | ❌ | Not shown (status ≠ active) |
| Storefront Search | ❌ | Not shown (status ≠ active) |
| Storefront Family Switcher | ❌ | Not shown (JOIN filters inactive) |

## Technical Details

- Placeholder IDs use `sq__` prefix (e.g. `sq__ABCDEF123`) — never collides with numeric Shopify IDs
- Status is `placeholder` in `products_projection`
- No schema changes required — uses existing columns and tables
- Slug generation skips placeholders on the storefront but generates CRM-visible slugs via the family system
