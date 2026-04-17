# Fix Round P0 — Design

**Status:** DRAFT
**Scope:** Client selector, location sync, field types, search-while-typing

---

## FIX-001: Product search while typing

**File:** `src/app/crm/products/page.tsx` — convert to hybrid

Current: server component with URL search params. Problem: requires form submit.

Solution: Keep server component for initial load. Add a client component wrapper that debounces input and updates URL params via `router.push` with shallow navigation. The server component re-renders on param change (Next.js App Router handles this).

Simpler alternative: convert to client component that fetches `/api/crm/products?q=...` with debounce. This is faster to build and matches the pattern used elsewhere.

**Decision:** Convert to client component with debounced fetch. Products list is not huge (< 500), so client-side filtering is fine.

**Changes:**
- `src/app/crm/products/page.tsx` — becomes thin server wrapper with auth check
- `src/app/crm/products/ProductsClient.tsx` — new client component
  - Debounced search input (200ms)
  - Type/vendor dropdowns (fetched once)
  - Stock toggle (in stock / out of stock / all)
  - Product grid with variant chips
  - Fetches from existing `/api/crm/products` endpoint

---

## FIX-005: Client selector improvements

**File:** `src/components/crm/ClientPicker.tsx` — modify

Changes:
1. Auto-load top 20 clients on open (empty query)
2. Search triggers at 0 chars (shows all), not 2
3. Show phone in results: `name · email · phone`
4. Response now includes phone (verify `/api/crm/clients` returns it — it does via `customersProjection`)

Minimal changes — the component structure is already good, just adjust thresholds and add phone display.

---

## FIX-011: Locations table + sync

**New table:** `locations` in `src/lib/db/schema.ts`

```
locations:
  id              text PK (e.g., 'loc_plateau')
  shopifyLocationId text (Shopify gid)
  name            text
  address         jsonb
  active          boolean default true
  syncedAt        timestamp
```

**New API:** `POST /api/crm/settings/locations/sync`
- Auth: `org:settings:locations`
- Calls Shopify Admin API `GET /admin/api/2024-04/locations.json`
- Upserts each location into the table
- Returns the synced locations

**Modify:** `/crm/settings/locations/page.tsx` — show locations from DB + "Sync from Shopify" button.

**Downstream:** All location dropdowns (appointments, staff, etc.) query from this table instead of hardcoded `LOCATIONS` map.

---

## FIX-014: Field types on inline edits

**File:** `src/app/crm/clients/[id]/ClientProfileClient.tsx` — modify InlineField

Add a `type` prop to InlineField: `'text' | 'date' | 'select'`

- `type='date'` → renders `<input type="date">` in edit mode
- `type='select'` → renders `<select>` with `options` prop
- Default stays text

Apply:
- Birthday → `type='date'`
- Anniversary → `type='date'`
- Pronouns → `type='select'` with options: she/her, he/him, they/them, custom
- Home Location → `type='select'` with options loaded from locations table

Date values normalized to ISO format before saving to Shopify metafield.

---

## Files summary

| File | Action | Fix |
|---|---|---|
| `app/crm/products/page.tsx` | Simplify to auth wrapper | FIX-001 |
| `app/crm/products/ProductsClient.tsx` | New — debounced search, variants, stock filter | FIX-001 |
| `components/crm/ClientPicker.tsx` | Modify — auto-load, show phone | FIX-005 |
| `lib/db/schema.ts` | Add locations table | FIX-011 |
| `api/crm/settings/locations/sync/route.ts` | New — Shopify location sync | FIX-011 |
| `app/crm/settings/locations/page.tsx` | Modify — show from DB + sync button | FIX-011 |
| `ClientProfileClient.tsx` | Modify InlineField (date/select types) | FIX-014 |
