# Fix Round — Issues from Testing (2026-04-16)

**Status:** Triage
**Source:** User testing feedback

---

## Products (7 issues)

### FIX-001: Search while typing (debounced)
Product search should filter as you type, not require submit.

### FIX-002: Show variants on product grid
Product cards should show available variants (colour, size) as chips or swatches.

### FIX-003: Filter by stock status
Add in-stock / out-of-stock filter to product list.

### FIX-004: Recommend needs variant selection
"Recommend to client" must let staff pick a specific variant, not just the product.

### FIX-005: Client selector improvements
Client picker (used in recommend, link, etc.) must:
- Auto-load recent/all clients on open
- Quick search while typing (debounced)
- Show name, email, and phone in results

### FIX-006: Product data model for specs
Frame measurements (width, bridge, temple, height, lens width) + material + shape should be structured metafields, not free text. Need a strategy for:
- Storing as individual Shopify metafields (frame_width, bridge_width, etc.)
- Syncing from product description or tags
- Shape/material/colour as product tags with naming convention

### FIX-007: Colour filter → variant colour mapping
Product variant colours need an abstraction layer to map to filterable colour categories. Either:
- Tag convention (colour:black, colour:tortoise)
- Or a CRM-managed mapping table

---

## CRM Core (2 issues)

### FIX-008: User attribution on all changes
Every CRM write (client edit, tag change, interaction, appointment, etc.) must record who made the change. Show staffId + name on timeline entries and audit log. Many routes already do this — audit for gaps.

### FIX-009: Command-K global search
Cmd+K should open a search palette with access to: clients, products, segments, appointments. Debounced search across all entities.

---

## Appointments (1 issue)

### FIX-010: Appointments need location, time, associate
Appointment creation/editing must include: location selector, time slot, assigned staff member. Verify these fields exist and are enforced.

---

## Locations (1 issue)

### FIX-011: Sync locations from Shopify
Locations aren't syncing. Need a Shopify locations API sync (or manual CRUD) so the locations table has data.

---

## Staff (1 issue)

### FIX-012: Invitation email not received
Clerk invitation email delivery issue. May need to verify Clerk email config or use a custom invitation flow.

---

## Segments (1 issue)

### FIX-013: Segment detail actions
After creating a segment, users need to:
- Open and view members
- Analyze (AI explain — already built)
- Execute suggested actions (e.g., "email this segment" → export to Klaviyo, or generate a campaign draft)
- View member list with quick stats

---

## Client Profile (8 issues)

### FIX-014: Field types on inline edit
Birthday → date picker. Home location → dropdown from locations. Pronouns → dropdown with common options + custom. Anniversary → date picker.

### FIX-015: Shopify sync on field edits
Ensure all inline edits (birthday, anniversary, pronouns, home_location) sync to Shopify metafields, not just local projection.

### FIX-016: Timeline as primary view
Timeline should take more visual space. It's the center column already but needs:
- Larger area
- Better visual hierarchy
- Easier "add" interactions (quick-add bar, not just modal)

### FIX-017: Visual recommendations
Product suggestions panel should show product images, not just text. "Recommend product" modal should be visual with image grid + quick search + preference-based filtering.

### FIX-018: Previous purchases on client page
Show purchase history with product images directly on the client page (not just order numbers).

### FIX-019: Membership/loyalty interaction
How does staff interact with loyalty? Need visible actions: view tier, adjust credits, change tier, pause/cancel. MembershipSection exists but may need UX improvements.

### FIX-020: Linked clients UX
"Link client" button exists but uses a raw Shopify ID input. Needs to use the improved ClientPicker (FIX-005).

### FIX-021: Timeline entries editable
Timeline entries (notes, calls, visits) should be editable and deletable inline. Currently read-only after creation.

### FIX-022: Suggested products empty
ProductSuggestions component shows nothing if the scoring API returns no results or the customer has no preferences. Need: fallback to trending/popular products, loading state, empty state with "Set preferences first" CTA.

---

## Priority order (suggested)

**P0 — Blocking usability:**
- FIX-005: Client selector (blocks recommend, link)
- FIX-011: Sync locations (blocks appointments, location scoping)
- FIX-014: Field types on edit
- FIX-001: Search while typing

**P1 — Important UX:**
- FIX-009: Command-K search
- FIX-013: Segment detail actions
- FIX-016: Timeline as primary
- FIX-017: Visual recommendations
- FIX-018: Previous purchases visual
- FIX-020: Linked clients UX
- FIX-022: Suggested products empty state

**P2 — Polish:**
- FIX-002: Variants on grid
- FIX-003: Stock filter
- FIX-004: Variant in recommend
- FIX-006: Product data model
- FIX-007: Colour mapping
- FIX-008: User attribution audit
- FIX-010: Appointment fields verify
- FIX-012: Invitation email
- FIX-015: Shopify sync verify
- FIX-019: Membership UX
- FIX-021: Editable timeline entries
