# Lunettiq CRM — Component Architecture & Design

**Date:** April 16, 2026
**Based on:** v1-requirements.md + codebase audit

---

## Codebase Patterns (follow these everywhere)

- **Pages**: Server component fetches data → passes to `*Client.tsx` client component
- **API routes**: Use `handler()` wrapper from `lib/crm/route-handler.ts`
- **Auth**: `requireCrmAuth(permission?)` — throws 401/403, caught by handler
- **Permissions**: `lib/crm/permissions.ts` — app-code enforcement. Migrating to Clerk native.
- **Styling**: CRM CSS vars (`--crm-*`) + inline styles. Classes: `.crm-card`, `.crm-btn`, `.crm-input`, `.crm-table`, `.crm-badge`
- **Mutations**: fetch() to API routes. No server actions (none exist yet).
- **Toast**: `useToast()` from CrmShell context
- **DB**: Drizzle ORM, Postgres via Neon

---

## Feature 1: Appointments Calendar

### Files to create/modify

```
src/app/crm/appointments/
  page.tsx                    — Server component: fetch initial week data
  AppointmentsClient.tsx      — Client component: calendar + panels

src/components/crm/
  WeekCalendar.tsx            — Pure display: 7-day grid, events, click handlers
  StaffPicker.tsx             — Pill toggles for staff filter/selection
  TimeSlotPicker.tsx          — Available slots grouped morning/afternoon
  AppointmentPanel.tsx        — Side panel: view details + status transitions
  NewAppointmentPanel.tsx     — Side panel: create form with slot picker

src/app/api/crm/staff/
  list/route.ts               — Lightweight staff list (id, name, imageUrl)
```

### Data flow

```
page.tsx (server)
  → fetch week appointments + staff list
  → pass to AppointmentsClient

AppointmentsClient (client)
  → state: weekStart, staffFilter, panel (null | view | create)
  → WeekCalendar receives events, fires onEventClick / onSlotClick
  → StaffPicker fires onChange → refetch appointments for that staff
  → AppointmentPanel shows detail + status buttons → PATCH /api/crm/appointments/[id]
  → NewAppointmentPanel → TimeSlotPicker + ClientPicker → POST /api/crm/appointments
```

### WeekCalendar props
```ts
interface Props {
  weekStart: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onSlotClick: (date: Date, hour: number) => void
  onWeekChange: (newStart: Date) => void
}
```

### Key decisions
- No external calendar library — custom grid is simpler for this use case
- Side panel (not modal) for create/view — stays in context of calendar
- Staff list endpoint gated on Clerk permission org:appointments:read

---

## Feature 2: Role Management

### Files to create/modify

```
src/app/crm/settings/staff/
  page.tsx                    — Rewrite: server fetch + StaffManagementClient
  StaffManagementClient.tsx   — Full staff table + invite + edit + suspend/offboard

src/app/api/crm/staff/
  route.ts                    — Keep existing GET, relax permission check
  invite/route.ts             — POST: invite via Clerk API
  [id]/route.ts               — PATCH: update role/locations via Clerk API
  [id]/suspend/route.ts       — POST: suspend via Clerk API
  [id]/offboard/route.ts      — POST: offboard (disable + reassign)
```

### Data flow

```
page.tsx (server)
  → fetch staff list from Clerk
  → pass to StaffManagementClient

StaffManagementClient
  → Table with filters (role, location)
  → Invite modal: email + role dropdown + location multi-select
  → Per-row actions: edit role, edit locations, suspend, offboard
  → All mutations → API routes → Clerk API → audit log
```

### Clerk API calls needed
- `clerkClient.invitations.createInvitation()` — invite
- `clerkClient.users.updateUser()` — update publicMetadata (role, location_ids)
- `clerkClient.users.banUser()` / `unbanUser()` — suspend/reinstate
- `clerkClient.users.deleteUser()` — offboard (or disable)

---

## Feature 3: Product Recommendations (Tier 1 only — try-on is fast follow)

### Files to create/modify

```
src/components/crm/
  ProductSearchModal.tsx      — Search/filter products, select to recommend
  ProductSuggestions.tsx       — "Suggested for this client" card on profile

src/app/api/crm/clients/[id]/
  suggestions/route.ts        — GET: smart product suggestions for a client

src/app/crm/clients/[id]/
  ClientProfileClient.tsx     — Add ProductSuggestions + "Recommend" button
```

### Suggestion algorithm (server-side, in API route)

```
1. Load client: face_shape, frame_width_mm, preferences_derived, stated preferences
2. Load client's purchased product IDs (from orders_projection line items)
3. Query products_projection:
   - Filter by matching tags (face shape, material, colour)
   - Exclude already-purchased products
   - Score by number of matching attributes
   - Return top 10 with match reasons
```

### ProductSearchModal props
```ts
interface Props {
  open: boolean
  onClose: () => void
  onSelect: (product: { id: string; title: string }) => void
  excludeProductIds?: string[]  // already owned
}
```

---

## Feature 4: AI Segmentation

### Files to create/modify

```
src/app/crm/segments/
  page.tsx                    — Add AI suggest button + expanded builder
  SegmentBuilderClient.tsx    — Extracted: expanded rule builder + AI panel

src/app/api/crm/segments/
  route.ts                    — Expand evaluateSegmentRules for new fields
  ai-suggest/route.ts         — POST: aggregate data → Claude → suggestions
  ai-analyze/route.ts         — POST: date-scoped analysis → Claude → insights
  [id]/route.ts               — GET single segment, GET members
  [id]/members/route.ts       — GET paginated member list
```

### AI data pipeline (no PII sent to Claude)

```
1. Aggregate from customers_projection + CRM tables:
   - LTV distribution (buckets: $0-100, $100-500, $500-1000, $1000+)
   - Order frequency histogram
   - Tag frequency (top 30)
   - Dormancy buckets (active, 30d, 90d, 180d, 365d+)
   - Tier breakdown (non-member, essential, cult, vault)
   - Avg order value distribution
   - Top product types/vendors
   - Consent rates (email, SMS)

2. Send aggregated stats to Claude with system prompt:
   "You are a CRM analyst for a luxury eyewear brand. Given these customer data aggregates, suggest 3-5 actionable segments. Return JSON with name, description, rules (field/operator/value arrays), and estimated reasoning."

3. Parse Claude response → render as suggestion cards
4. User accepts → creates segment via existing POST /api/crm/segments
```

### Expanded rule builder fields (add to FIELDS array)

```ts
// Add to existing 9 fields:
{ value: 'last_order_date', label: 'Last Order Date', group: 'Recency' },
{ value: 'days_since_last_order', label: 'Days Since Last Order', group: 'Recency' },
{ value: 'created_at', label: 'Customer Since', group: 'Identity' },
{ value: 'home_location', label: 'Home Location', group: 'Location' },
{ value: 'face_shape', label: 'Face Shape', group: 'Fit' },
{ value: 'rx_on_file', label: 'Rx On File', group: 'Fit' },
{ value: 'membership_tier', label: 'Membership Tier', group: 'Loyalty' },
{ value: 'interaction_count', label: 'Interaction Count', group: 'Engagement' },
{ value: 'average_order_value', label: 'Avg Order Value', group: 'Commercial' },
```

### Dependencies
- `@anthropic-ai/sdk` npm package
- `ANTHROPIC_API_KEY` env var

---

## Feature 5: Client Sanitization + Dedup

### Files to create/modify

```
src/lib/db/schema.ts          — Add duplicate_candidates + client_links tables

src/lib/inngest/functions.ts   — Add dedup scan job

src/app/crm/clients/
  duplicates/page.tsx          — Review queue (server fetch → DuplicatesClient)
  duplicates/DuplicatesClient.tsx — Side-by-side compare, merge/dismiss

src/app/api/crm/clients/
  duplicates/route.ts          — GET candidates, POST dismiss
  merge/route.ts               — POST merge two clients
  [id]/link/route.ts           — POST create link
  [id]/enrich/route.ts         — POST AI enrichment via Claude
```

### New DB tables

```sql
duplicate_candidates:
  id uuid PK
  client_a text (shopify_customer_id)
  client_b text (shopify_customer_id)
  match_reason text ('exact_email' | 'exact_phone' | 'fuzzy_name')
  confidence decimal (0-1)
  status text ('pending' | 'merged' | 'dismissed')
  created_at timestamp

client_links:
  id uuid PK
  client_a text
  client_b text
  relationship text ('family' | 'household' | 'corporate')
  created_by text (staff_id)
  created_at timestamp
```

### Merge logic (critical — preserves source)

```
1. Pick primary (higher LTV or more orders)
2. Re-link secondary's CRM data to primary:
   - UPDATE interactions SET shopify_customer_id = primary WHERE = secondary
   - Same for appointments, second_sight_intakes, credits_ledger
3. Merge tags: union of both tag arrays → write to Shopify primary
4. Archive secondary: add tag 'merged-into-[primaryId]', set do_not_contact
5. Create audit log entry with full merge details
6. Mark duplicate_candidate as 'merged'
```

### Data normalization (on create/update)
- Phone: strip non-digits, format E.164 (+1XXXXXXXXXX)
- Email: lowercase, trim whitespace
- Name: trim, title case

---

## Feature 6: VIP Loyalty System

### Files to create/modify

```
src/components/crm/
  MembershipCard.tsx           — Tier badge, credits, renewal, perks
  CreditsLedger.tsx            — Transaction table with filters
  CreditAdjustModal.tsx        — Amount + reason + confirm
  TierChangeModal.tsx          — Select tier + confirm

src/app/crm/clients/[id]/
  ClientProfileClient.tsx      — Add MembershipCard + CreditsLedger sections

src/app/api/crm/clients/[id]/
  credits/route.ts             — GET ledger, POST adjust
  membership/route.ts          — PATCH tier/status changes

src/lib/inngest/functions.ts   — Add: monthly credit issuance, birthday credits,
                                  lens refresh, nightly reconciliation
```

### Credit issuance (Inngest cron jobs)

```
Monthly (1st of month):
  → Query all active members
  → For each: insert credits_ledger row (issued_membership)
  → Amount by tier: Essential=$15, CULT=$30, VAULT=$60
  → Update Shopify metafield credits_balance

Birthday (daily check):
  → Query members with birthday = today
  → Issue $20 credit (Essential), scaled for higher tiers

Lens refresh (annual, on member_since anniversary):
  → CULT/VAULT only: issue $40 lens refresh credit

Nightly reconciliation:
  → For each member: SUM(credits_ledger.amount) vs Shopify metafield
  → If drift > $0.01: log warning, auto-correct if < $5, flag if >= $5
```

---

## Implementation Order

Build in this sequence — each builds on the previous:

1. **Appointments calendar** — standalone, no dependencies on other features
2. **Role management** — needed for proper permission gating on everything else
3. **Client dedup + sanitization** — clean data before building on top of it
4. **Loyalty system** — credits ledger + tier management on client profile
5. **Product recommendations** — needs clean client data + preferences
6. **AI segmentation** — needs all data flowing to build meaningful segments

Each feature is a self-contained PR. Ship and verify before starting the next.

---

## Files to delete (my earlier hallucinated code)

These were written without proper design. Delete and rebuild:
- `src/app/crm/appointments/page.tsx` (overwritten)
- `src/app/crm/appointments/actions.ts` (new, not needed)
- `src/components/crm/WeekCalendar.tsx` (new)
- `src/components/crm/StaffPicker.tsx` (new)
- `src/components/crm/TimeSlotPicker.tsx` (new)
