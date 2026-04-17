# Phase C — Client Profile Completeness: Requirements

**Status:** DRAFT — awaiting review
**Scope:** Client profile layout, activity timeline, consent, returns, custom fields, interaction logging, exports
**Sources:** Spec 07 §4, audit findings (specs 03/04)
**Depends on:** Phase A (auth, permissions, audit), Phase B (staff lifecycle)

---

## Profile Layout

### REQ-C-001: Three-column client profile
The client detail page must use a three-column layout: identity (sticky left), activity timeline (scrollable center), context panels (collapsible right).

**Acceptance criteria:**
- Left column: avatar, name, pronouns, tier badge, credits balance, contact info, consent toggles, LTV, order count, return rate, tags
- Center column: unified activity timeline with filter chips
- Right column: collapsible sections for fit profile, preferences, recent orders, try-on history, Second Sight, custom designs, related clients, internal notes
- Left column stays visible while center scrolls
- All fields editable inline with appropriate permission checks

---

### REQ-C-002: Identity column — all contact fields
The left column must display and allow inline editing of all contact fields.

**Acceptance criteria:**
- Fields: name, pronouns, email, phone, birthday, anniversary, home location
- Each field editable inline (click to edit, save on blur/enter)
- Phone normalized to E.164 on save
- Email lowercased and trimmed on save
- Edits write to Shopify via Admin API AND update the local projection
- Requires `org:clients:update` permission to edit

---

## Consent

### REQ-C-003: Consent toggles with confirmation
Email, SMS, and Do Not Contact toggles must require confirmation before changing.

**Acceptance criteria:**
- Three toggles visible: Email consent, SMS consent, Do Not Contact
- Toggling opens a confirmation modal showing: impact description, optional reason field, source selector (client requested verbally / client requested by email / staff decision)
- On confirm: writes to Shopify, fires Klaviyo subscription update (if applicable), creates audit log entry with source + reason + staffId
- Requires `org:consent:update` permission

---

## Activity Timeline

### REQ-C-004: Unified activity timeline
The center column must show a combined, chronological feed from all data sources.

**Acceptance criteria:**
- Sources: interactions (notes, calls, visits), orders, product interactions (try-ons, recs), credits ledger, appointments, tag changes
- Each entry shows: icon, type label, date, summary, expandable details
- Filter chips at top: All, Orders, Notes, Calls, Visits, Try-ons, Credits, Appointments (multi-select)
- Paginated via cursor (infinite scroll or "Load more")
- API endpoint: `GET /api/crm/clients/[id]/timeline`
- Requires `org:interactions:read` permission

---

### REQ-C-005: Order entries show product context
Order entries in the timeline must show product images, SKUs, sizes, and line item details.

**Acceptance criteria:**
- Each order entry shows: order number, date, location, total
- Expandable to show line items with: product image, title, variant, SKU, size, price
- Product image pulled from products_projection
- Clicking product links to `/crm/products/[id]`

---

## Interaction Logging

### REQ-C-006: Log interaction modal
Staff must be able to log interactions (notes, calls, visits) from the timeline.

**Acceptance criteria:**
- "+ Add interaction" button in timeline header
- Modal with fields: type (note, call, in-store visit), title (optional), body (text), related order (optional dropdown), location (auto-filled from staff's primary)
- Saves to `interactions` table
- Appears immediately in timeline after save
- Requires `org:interactions:create` permission

---

## Returns

### REQ-C-007: Return rate display
The identity column must show the client's return rate.

**Acceptance criteria:**
- Calculated as: returned line items / total line items (from orders_projection)
- Displayed as percentage in the identity column
- Visible to users with `org:orders:read` permission

---

## Custom Fields

### REQ-C-008: Freeform custom fields
Staff must be able to add arbitrary key-value fields to a client profile.

**Acceptance criteria:**
- "Custom fields" section in the right column
- Each field: key (text), value (text), added by (staff name), added date
- "+ Add field" button opens inline form
- Key input suggests existing keys (from other clients) to prevent sprawl
- Stored in customer metafields as `custom.custom_fields` JSON array
- Requires `org:clients:update` permission

---

## Exports

### REQ-C-009: Single client export
Staff must be able to export a single client's full profile.

**Acceptance criteria:**
- Available from client profile actions menu
- Formats: JSON (all data), CSV (flat attributes)
- Endpoint: `GET /api/crm/clients/[id]/export?format=json|csv`
- Requires `org:clients:export_single` permission

---

### REQ-C-010: Bulk client export
Staff must be able to export multiple clients.

**Acceptance criteria:**
- Available from clients list page
- Filterable by: segment, tag
- Format: CSV (streaming)
- Endpoint: `GET /api/crm/clients/export?segmentId=&tag=&format=csv`
- Large exports (>5000 rows) return immediately with a job ID; result emailed when ready
- Requires `org:clients:export_bulk` permission

---

## Bug Fixes (from audit)

### REQ-C-011: Merge must sync tags to Shopify
When merging duplicate clients, tag changes must be written to Shopify via Admin API, not just the local projection.

**Acceptance criteria:**
- Merge route calls Shopify Admin API to update tags on the primary customer
- Merge route calls Shopify Admin API to add `merged-into-*` tag on the secondary customer
- Projection is updated after Shopify confirms

**Source:** Audit finding — merge only updated local projection

---

### REQ-C-012: Client linking UI
The related clients section must allow creating new links, not just displaying existing ones.

**Acceptance criteria:**
- "Link client" button in the related clients section
- Opens a client picker + relationship type selector (family, household, corporate)
- Creates link via existing `POST /api/crm/clients/[id]/link`
- Requires `org:clients:update` permission

**Source:** Audit finding — client linking was read-only

---

### REQ-C-013: PATCH normalization
When updating a client via PATCH, normalized values must be written to the projection, not raw input.

**Acceptance criteria:**
- Phone, email, and name are normalized before writing to both Shopify and the projection
- Projection values match what Shopify stores

**Source:** Audit finding — PATCH wrote raw values to projection

---

## Out of Scope for Phase C

- PDF export (V2)
- Klaviyo email/SMS event sync into timeline (V2)
- Rx fields and fit profile editing (separate spec)
- Rich text in interaction notes (V2 — plain text for now)

---

## Traceability

| Requirement | Audit Finding | Spec 07 Section |
|---|---|---|
| REQ-C-001 | — | §4.2 |
| REQ-C-002 | — | §4.3 |
| REQ-C-003 | — | §4.4 |
| REQ-C-004 | — | §4.5 |
| REQ-C-005 | — | §4.6 |
| REQ-C-006 | — | §4.9 |
| REQ-C-007 | — | §4.7 |
| REQ-C-008 | — | §4.8 |
| REQ-C-009 | — | §4.10 |
| REQ-C-010 | — | §4.10 |
| REQ-C-011 | Merge doesn't sync to Shopify | §4 (dedup fix) |
| REQ-C-012 | Client linking read-only | §4 (dedup fix) |
| REQ-C-013 | PATCH writes raw values | §4 (normalization fix) |
