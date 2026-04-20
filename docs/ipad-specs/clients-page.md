# iPad App — Clients Page Spec

## Purpose
Search and browse the client database. Entry point to client profiles.

## Layout (iPad landscape)
- Full-width search bar at top with instant fuzzy search
- Results as a scrollable list (left 40%) + selected client preview (right 60%)
- Tap a row to load preview; double-tap or "Open" to navigate to full profile

## API Calls

| Action | Endpoint | Trigger |
|---|---|---|
| Search/list | `GET /api/crm/clients?q={query}&tag={tag}&sort={sort}&dir={dir}&limit=50&offset=0` | On type (300ms debounce) |
| Load more | Same with `offset` incremented | Scroll to bottom |

## Data Displayed Per Row
- Name (first + last)
- Tier badge (from `tags` → `member-*`)
- Email
- Order count + LTV
- Last visit date (from most recent interaction)

## Preview Panel (right side)
When a client row is selected:
- Name, tier, member since
- Stated preferences (shapes, materials, colours)
- Face shape + frame width
- Last 3 orders (number, date, total)
- Quick actions: "Open Profile", "Start Session", "Book Appointment"

## Filters
- Tag filter (text input or dropdown of common tags)
- Sort: Name, LTV, Orders, Recent activity

## Empty States
- No results: "No clients match '{query}'"
- Initial load: Show all clients sorted by recent activity

## Interactions
- Pull-to-refresh
- Swipe row left → quick actions (call, note)
- "+" button → create new client (modal with name, email, phone)
