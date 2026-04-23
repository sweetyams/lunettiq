# Product Management UI — Patterns & Standards

## Product Picker

### `InlineProductPicker` (`components/crm/InlineProductPicker.tsx`)

Shared component used across all CRM surfaces that need product selection.

| Prop | Type | Description |
|---|---|---|
| `excludeIds` | `Set<string>` | Products to hide (already selected) |
| `multi` | `boolean` | Enable checkboxes + Select All |
| `showVariants` | `boolean` | Show variant sub-picker per product |
| `onSelect` | `(id, variantId?) => void` | Single select callback |
| `onSelectMulti` | `(ids[]) => void` | Multi-select callback |
| `hint` | `string` | Pre-fill search |
| `maxHeight` | `number` | Scroll area height (default 320) |

**Features:** Table layout, image thumbnails, status badges, vendor/type filters, search, product count, variant expander.

**Used in:**
- Settings → Families (add member modal)
- Products → Family Detail (add product modal)
- Settings → Square Mapping (link product)
- Settings → Filters (assign product)

### `ProductSearchModal` (`components/crm/ProductSearchModal.tsx`)

Full-screen modal with grid layout. Used for contexts needing a richer browsing experience.

**Used in:**
- Client Canvas (recommend product)
- Configurator Preview (test product)
- Flow Builder (add product choice)

## Table Standards

### Enclosed Table Pattern

All product tables use this structure:

```
Header (title, count, actions, filters) — outside table
Colour swatches / metadata — outside table
┌─────────────────────────────────────────┐
│ thead: bg #f9fafb, font 10px #6b7280   │
├─────────────────────────────────────────┤
│ tbody: bg #fff, font 12px, pad 6px 10px│
│ rows separated by borderTop #f3f4f6    │
│ ✕ remove button: color #d1d5db         │
└─────────────────────────────────────────┘
```

**Wrapper style:** `border: 1px solid #e5e7eb, borderRadius: 8, overflow: hidden, background: #fff`

**Applied to:**
- Settings → Families (member table)
- Settings → Filters (assignments + unassigned tables)

### Source Filter (Shopify / Square / All)

Both families and filters pages have identical source filter buttons:

- Order: Shopify → Square → All
- Default: `'shopify'`
- Style: `fontSize: 10, padding: '3px 10px', borderRadius: 4`
- Shopify active: bg `#dbeafe`, text `#1e40af`
- Square active: bg `#fef3c7`, text `#92400e`
- All active: bg `var(--crm-text-primary)`, text `#fff`
- Inactive: bg `var(--crm-surface-hover)`, text `var(--crm-text-tertiary)`

### Status Badge

See `.kiro/docs/product-status-badge.md` for the full badge spec and location map.

## Auto-Assign Families

`POST /api/crm/settings/families/auto-assign`

Parses product handles to extract family name, type, and colour. Creates new families if needed. Assigns all unassigned products.

Handle parsing: `{family}-opt-{colour}` or `{family}-©-{colour}` → family ID, optical/sun type, colour name.

## Archived Product Filtering

- All product APIs exclude archived by default
- `?status=active,draft` used by all product fetches
- Full Product Sync cleans up archived products from relationship tables
- See `.kiro/docs/full-product-sync.md` for the full relationship map
