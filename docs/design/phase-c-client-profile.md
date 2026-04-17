# Phase C — Client Profile Completeness: Design

**Status:** DRAFT
**Prereq:** Phase A + B complete

---

## D-018: Three-column profile layout (REQ-C-001, REQ-C-002)

**File:** `src/app/crm/clients/[id]/ClientProfileClient.tsx` — major rewrite

Current: two-column (left content + right sidebar).
New: three-column (identity sticky left, timeline center, context right).

```
┌──────────────┬──────────────────────────────┬──────────────────┐
│ IDENTITY     │ TIMELINE                     │ CONTEXT          │
│ (240px,      │ (flex-1, scrollable)         │ (320px,          │
│  sticky)     │                              │  collapsible)    │
│              │                              │                  │
│ Name         │ Filter chips                 │ ▸ Fit profile    │
│ Pronouns     │ [All][Orders][Notes]...      │ ▸ Preferences    │
│ Tier badge   │                              │ ▸ Recent orders  │
│ Credits      │ Timeline entries...          │ ▸ Suggestions    │
│ Email [✓]    │                              │ ▸ Related clients│
│ Phone [✓]    │                              │ ▸ Custom fields  │
│ Birthday     │                              │ ▸ Notes          │
│ Anniversary  │                              │                  │
│ Home loc     │                              │                  │
│ LTV / Orders │                              │                  │
│ Return rate  │                              │                  │
│ Tags         │                              │                  │
└──────────────┴──────────────────────────────┴──────────────────┘
```

Identity column uses `position: sticky; top: 0; align-self: flex-start`.

All `InlineField` edits call `patchClient` which writes to Shopify + projection (existing pattern).

Add `anniversary` field (metafield `custom.anniversary`). Add return rate (computed from orders prop).

---

## D-019: Timeline API (REQ-C-004, REQ-C-005)

**File:** `src/app/api/crm/clients/[id]/timeline/route.ts` — new

```
GET /api/crm/clients/[id]/timeline
Auth: org:interactions:read
Query: filter (comma-separated types), cursor, limit (default 50)
```

Combines rows from:
- `interactions` — notes, calls, visits
- `ordersProjection` — orders with lineItems
- `creditsLedger` — credit events
- `appointments` — past appointments

Each source queried separately, merged and sorted by date, cursor-paginated.

Response shape:
```ts
{ data: TimelineEntry[], nextCursor: string | null }

type TimelineEntry = {
  id: string;
  type: 'note' | 'call' | 'visit' | 'order' | 'credit' | 'appointment' | 'recommendation';
  date: string;
  summary: string;
  details?: Record<string, unknown>; // order line items, credit amount, etc.
}
```

Order entries include `lineItems` with product titles and images (joined from `productsProjection`).

---

## D-020: Timeline UI component (REQ-C-004, REQ-C-005)

**File:** `src/components/crm/ActivityTimeline.tsx` — new

Replaces the current `InteractionTimeline` in the center column.

- Fetches from `/api/crm/clients/[id]/timeline` on mount
- Filter chips at top (multi-select, updates `filter` query param)
- Each entry: icon (by type), date, summary line, expandable details
- Order entries expand to show line items with product image + title + price
- "Load more" button at bottom (cursor pagination)

---

## D-021: Consent toggles with confirmation (REQ-C-003)

**File:** `src/components/crm/ConsentToggle.tsx` — rewrite

Current: simple toggle, no confirmation. New:

1. Toggle click opens confirmation modal
2. Modal shows: impact text, reason field (optional), source radio (verbal/email/staff decision)
3. On confirm: PATCH to client API with consent change + source + reason
4. Client API writes to Shopify + audit log with source/reason
5. Gated by `usePermission('org:consent:update')`

---

## D-022: Interaction logging modal (REQ-C-006)

**File:** `src/components/crm/LogInteractionModal.tsx` — new

Triggered by "+ Add Interaction" button in timeline header.

Fields: type select (note/call/visit), title (optional), body (textarea), location (auto-filled).

POST to existing `/api/crm/interactions` endpoint. On success, refetch timeline.

---

## D-023: Return rate (REQ-C-007)

Computed in the server component from `orders` prop. No new API needed.

```ts
const totalItems = orders.reduce((sum, o) => sum + (o.lineItems as any[])?.length ?? 0, 0);
const returnedItems = orders.reduce((sum, o) => sum + ((o.lineItems as any[])?.filter(li => li.returned) ?? []).length, 0);
const returnRate = totalItems > 0 ? Math.round((returnedItems / totalItems) * 100) : 0;
```

Passed as prop to `ClientProfileClient`, displayed in identity column.

---

## D-024: Custom fields (REQ-C-008)

**File:** `src/components/crm/CustomFields.tsx` — new

Section in right column. Reads from `metafields.custom.custom_fields` (JSON array).

- Renders key-value pairs with "added by" and date
- "+ Add field" opens inline form with key input (with autocomplete from existing keys) and value input
- Save writes via `patchClient({ metafields: { custom_fields: { value: JSON.stringify(updated) } } })`
- Key autocomplete: fetch unique keys from `/api/crm/clients/custom-field-keys` (simple distinct query)

---

## D-025: Single client export (REQ-C-009)

**File:** `src/app/api/crm/clients/[id]/export/route.ts` — new

```
GET /api/crm/clients/[id]/export?format=json|csv
Auth: org:clients:export_single
```

JSON: full client + orders + interactions + preferences.
CSV: flat client attributes as one row.

---

## D-026: Bulk client export (REQ-C-010)

**File:** `src/app/api/crm/clients/export/route.ts` — new

```
GET /api/crm/clients/export?tag=&segmentId=&format=csv
Auth: org:clients:export_bulk
```

Streams CSV rows. For >5000 results, returns `{ jobId }` and queues via Inngest.

---

## D-027: Merge Shopify sync (REQ-C-011)

**File:** `src/app/api/crm/clients/merge/route.ts` — modify

After updating local projection tags, add Shopify Admin API calls:
1. Update primary customer tags in Shopify
2. Update secondary customer tags in Shopify (add `merged-into-*`)

Use existing `src/lib/shopify/customer.ts` helpers.

---

## D-028: Client linking UI (REQ-C-012)

**File:** `src/app/crm/clients/[id]/ClientProfileClient.tsx` — modify RelatedClients

Add "Link client" button that opens:
1. `ClientPicker` component (already exists) to select a client
2. Relationship type dropdown (family/household/corporate)
3. Save calls `POST /api/crm/clients/[id]/link`

---

## D-029: PATCH normalization fix (REQ-C-013)

**File:** `src/app/api/crm/clients/[id]/route.ts` — modify

In the PATCH handler, after normalizing for Shopify, use the same normalized values when updating the projection. Change from `body.email` to `normalized.email`, etc.

---

## Files summary

| File | Action | REQs |
|---|---|---|
| `ClientProfileClient.tsx` | Major rewrite (3-col layout) | C-001, C-002, C-012 |
| `api/crm/clients/[id]/timeline/route.ts` | New | C-004, C-005 |
| `components/crm/ActivityTimeline.tsx` | New | C-004, C-005 |
| `components/crm/ConsentToggle.tsx` | Rewrite | C-003 |
| `components/crm/LogInteractionModal.tsx` | New | C-006 |
| `components/crm/CustomFields.tsx` | New | C-008 |
| `api/crm/clients/[id]/export/route.ts` | New | C-009 |
| `api/crm/clients/export/route.ts` | New | C-010 |
| `api/crm/clients/merge/route.ts` | Modify | C-011 |
| `api/crm/clients/[id]/route.ts` | Modify | C-013 |
| `clients/[id]/page.tsx` | Modify (add return rate) | C-007 |

No new DB tables. Timeline API combines existing tables.
