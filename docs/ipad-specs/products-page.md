# iPad App — Products Page Spec

## Purpose
Browse and search the full product catalogue. Used in discovery mode and during client sessions to find frames.

## Layout (iPad landscape)
- Search bar + filter row at top
- Product grid (3 columns on iPad 12.9", 2 on 11")
- Tap card → product detail sheet (slides up from bottom, 70% height)

## API Calls

| Action | Endpoint | Trigger |
|---|---|---|
| Search/browse | `GET /api/crm/products?q={query}&type=&vendor=&material=&rx=&tag=&limit=24` | On type (300ms debounce) |
| Load more | Same with increased `limit` or pagination | Scroll to bottom |
| Client-scored search | `GET /api/crm/products/search?q={query}&customerId={id}&limit=12` | When client context is active |

## Product Card
- Product image (square, lazy loaded)
- Title
- Vendor
- Price (range if variants differ)
- Stock indicator: green dot (in stock) / red dot (out) / number
- Fit badge (if client context active): ✓ / ⚠ / ✗ based on frame_width diff

## Filters (horizontal scroll pills)
- Type: Optical, Sun, Accessories
- Vendor: brand names
- Material: Acetate, Metal, Titanium, etc.
- Rx: Compatible / Non-Rx
- Stock: In Stock / All
- Tag: any product tag

## Client Context Mode
When navigated from a client profile:
- Header shows "Browsing for {client name}" with dismiss button
- Default sort switches to scored (suggestions algorithm)
- Fit badge appears on each card
- "Recommend" button appears on product detail sheet
- Match reasons shown on detail sheet ("Matches face shape", "Preferred material")

## Empty States
- No results: "No products match your search"
- No stock: "This frame is currently out of stock at all locations"
