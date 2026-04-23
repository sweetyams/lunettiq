# Spec: Extended Group Types — Product, Content, Lens Colour

## Revised Concept

These are **choice types** — each choice in a group defines its own behaviour. A single group can mix types (e.g. standard choices alongside a colour picker and a content block).

| Choice Type | Source | Renders as | Cart behaviour |
|---|---|---|---|
| `standard` | `cfg_choices` | Selectable row | Attribute on frame line |
| `product` | `cfg_choices` with `shopify_product_id` | Selectable row | Separate cart line |
| `colour` | `cfg_choices` with `lens_colour_set_id` | Selectable row → expands swatch picker | Colour code attribute |
| `content` | `cfg_choices` with `content_body` | Info card (display only) | No cart impact |

---

## 1. Product Groups (Add-ons)

A group where each choice is a Shopify product. Uses existing `group_choices` → `cfg_choices` — the choice just happens to reference a product.

### Schema changes

**`cfg_choices`** — add columns:

| Column | Type | Description |
|---|---|---|
| `image_url` | text | Display image |
| `shopify_product_id` | text | Linked Shopify product (for price, inventory, cart line) |

### Behaviour

- Group type `product`, selection mode `multi` (0 or more)
- Each selected add-on becomes a **separate cart line** (not a configuration attribute)
- Price comes from Shopify product (live) or from `cfg_price_rules` if CRM-defined
- Group rules (`min_select`, `max_select`) control "pick any" vs "pick up to 2" etc.

### Example

```
Step: "Accessories"
Group: type=product, mode=multi
  ☐ Clip-on Sunglasses  $89   [product image]
  ☐ Cleaning Kit         $25   [product image]
  ☐ Hard Case Upgrade    $45   [product image]
```

---

## 2. Content Groups

A group that displays information — no selection. Uses existing `selection_mode: 'none'`.

### Schema changes

**`cfg_choices`** — add column:

| Column | Type | Description |
|---|---|---|
| `image_url` | text | (shared with product groups above) |
| `content_body` | text | Rich text / markdown for detailed content |

### Behaviour

- Group type `content`, selection mode `none`
- Renders as info cards: image + label + description + optional content body
- Auto-continues or shows "Continue" button
- No cart impact

### Example

```
Step: "What's Included"
Group: type=content, mode=none
  📦 ZEISS ClearView Lenses     [image]  "Premium single vision..."
  🛡️ 2-Year Scratch Warranty    [image]  "Full coverage..."
  📦 Premium Case & Cloth       [image]  "Microfibre cloth..."
```

---

## 3. Lens Colour System

This is the most structured one. Lens colours are a **shared catalogue** organised into sets. A set represents a category of lens finish (Standard Sun, Polarized, Custom Tint, etc.). Each colour within a set has rich display data.

### New tables

**`lens_colour_sets`** — the parent categories

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `code` | text unique | `standard_sun`, `polarized`, `custom_tint`, `interior_tint`, `transitions` |
| `label` | text | "Standard Sun Lens", "Polarized", "Custom Dipped Tint" |
| `description` | text | Short description of this lens category |
| `sort_order` | integer | |
| `status` | choice_status | |
| `created_at` | timestamp | |

**`lens_colour_options`** — individual colours

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `set_id` | uuid FK → lens_colour_sets | Which set this belongs to |
| `code` | text unique | `pol_black`, `custom_rose`, `std_brown_gradient` |
| `label` | text | "Black", "Rose", "Brown Gradient" |
| `short_description` | text | One-liner: "Cool and calming" |
| `description` | text | Full: "A modern tint, at home in clear and colourful frames. Offers 85% light absorption..." |
| `swatch_url` | text | Small swatch image for the grid |
| `image_url` | text | Full lens/frame preview image |
| `hex` | text | Fallback hex if no swatch image |
| `price` | decimal(12,2) | Price delta for this colour (0 = included) |
| `category` | text | "Solid", "Gradient", "Fade" — for sub-grouping within the picker |
| `sort_order` | integer | |
| `status` | choice_status | |
| `created_at` | timestamp | |

### How it connects to flows

**`step_choice_groups`** — add column:

| Column | Type | Description |
|---|---|---|
| `lens_colour_set_id` | uuid FK → lens_colour_sets | If set, group renders as a lens colour picker from this set |

When `lens_colour_set_id` is set:
- Group type is `lens_colour`
- Ignores `group_choices` — pulls options from `lens_colour_options` where `set_id` matches
- Renders as swatch grid, grouped by `category`
- Selected colour code stored as configuration attribute
- `display_style: 'swatches'` implied

### The two-level picker

On the PDP, the lens colour step works like Cubitts:

1. **First level**: Choose the lens finish (set) — "As shown", "Custom colour", "Polarized"
   - This is a standard group with choices like `as_shown`, `custom_colour`, `polarized`
   
2. **Second level**: If "Custom colour" or "Polarized" selected → show the colour picker from the linked `lens_colour_set`
   - This is a `lens_colour` group that appears conditionally (via existing visibility rules)

So a step might have two groups:
- Group 1: "Lens Finish" (standard, single-select) → As shown, Custom, Polarized
- Group 2: "Custom Colours" (lens_colour, single-select, `lens_colour_set_id` → `custom_tints`) — visible only when Group 1 = "custom_colour"
- Group 3: "Polarized Colours" (lens_colour, single-select, `lens_colour_set_id` → `polarized`) — visible only when Group 1 = "polarized"

### Example data

```
Set: "Polarized" (code: polarized)
  Black           [swatch]  Solid
  Brown           [swatch]  Solid
  Green           [swatch]  Solid
  Brown Gradient  [swatch]  Gradient
  Green Gradient  [swatch]  Gradient

Set: "Custom Dipped Tint" (code: custom_tint)
  Brown           [swatch]  Solid     "Rich and warm..."
  Green           [swatch]  Solid
  Grey            [swatch]  Solid
  Blue            [swatch]  Solid
  Burgundy        [swatch]  Solid
  Champagne       [swatch]  Solid
  Red             [swatch]  Solid
  Khaki           [swatch]  Solid
  Flame Fade      [swatch]  Fade
  Dusk            [swatch]  Fade
  Palm Fade       [swatch]  Fade
  Rose            [swatch]  Solid     "Warm and striking. A more statement tint..."
  Ocean Fade      [swatch]  Fade
  Wine Fade       [swatch]  Fade
  Emerald         [swatch]  Solid
  Yellow          [swatch]  Solid

Set: "Transitions" (code: transitions)
  Grey            [swatch]  —
  Brown           [swatch]  —
  Graphite Green  [swatch]  —
```

---

## Schema changes summary

| Table | Change |
|---|---|
| `cfg_choices` | Add `choice_type` enum, `lens_colour_set_id` uuid FK, `image_url` text, `shopify_product_id` text, `content_body` text |
| New: `lens_colour_sets` | Shared catalogue of lens finish categories |
| New: `lens_colour_options` | Individual colours within a set (with price) |
| New enum: `choice_type` | `standard`, `product`, `colour`, `content` |

## CRM management

- **Lens Colours** settings page (new) — CRUD for sets and their colours with image upload
- Flow builder: group type selector, lens colour set picker when type = `lens_colour`
- Colours reusable across any flow

## Migration path

1. Add `group_type` enum + columns to existing tables
2. Add `lens_colour_sets` + `lens_colour_options` tables
3. Seed initial colour data (Polarized, Custom Tint, Transitions, Standard Sun)
4. Build Lens Colours settings page
5. Update flow builder group form
6. Update storefront configurator rendering
7. Update cart serialization for product add-ons + colour selections

## Implementation Status

| Step | Status | File(s) |
|---|---|---|
| Schema: `group_type` enum | ✅ | `lib/db/schema.ts` |
| Schema: `lens_colour_sets` + `lens_colour_options` tables | ✅ | `lib/db/schema.ts` |
| Schema: `group_type` + `lens_colour_set_id` on `step_choice_groups` | ✅ | `lib/db/schema.ts` |
| Schema: `image_url`, `shopify_product_id`, `content_body` on `cfg_choices` | ✅ | `lib/db/schema.ts` |
| Seed: 4 sets, 17 colours (Standard, Custom Solid, Custom Fade, Polarized) | ✅ | `scripts/seed-lens-colours.ts` |
| API: Lens colours CRUD | ✅ | `app/api/crm/settings/lens-colours/route.ts` |
| CRM UI: Lens Colours settings page | ✅ | `app/crm/settings/lens-colours/` |
| CRM Settings: Lens Colours link | ✅ | `app/crm/settings/page.tsx` |
| ADR-010 logged | ✅ | `.kiro/docs/decisions.md` |
| Flow builder: group type selector + palette linking | ✅ | `FlowPanels.tsx`, `FlowEditor.tsx` |
| Storefront: render new group types | ✅ | `LiveConfiguratorPreview.tsx` |
| Cart: add-on product line items | ✅ | `lib/configurator/serialize-flow.ts`, `context/CartContext.tsx` |

## Requirements

| ID | Requirement | Status |
|---|---|---|
| REQ-ECT-001 | Lens colour sets are a shared catalogue, not per-flow | ✅ |
| REQ-ECT-002 | Each colour has label, short desc, full desc, swatch, image, hex, price, category | ✅ |
| REQ-ECT-003 | Price stored at lens_colour_options level | ✅ |
| REQ-ECT-004 | Sets CRUD via CRM settings page | ✅ |
| REQ-ECT-005 | Colours CRUD with hex preview | ✅ |
| REQ-ECT-006 | Groups link to a set via lens_colour_set_id | ✅ |
| REQ-ECT-007 | group_type enum: standard, product, content, lens_colour | ✅ |
| REQ-ECT-008 | Product groups: choices with shopify_product_id become separate cart lines | ✅ |
| REQ-ECT-009 | Content groups: selection_mode none, display-only | ✅ |
| REQ-ECT-010 | Lens colour groups: render swatches from linked set | ✅ |
| REQ-ECT-011 | Seed data: Standard ($0), Custom Solid ($25), Custom Fade ($25), Polarized ($70) | ✅ |
