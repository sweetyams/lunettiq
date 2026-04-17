# Spec 03: Client Sanitization + Dedup

**Status:** APPROVED
**Dependencies:** None
**Permissions used:** org:clients:read, org:clients:update, org:clients:merge

---

## What exists today

### DB schema
- `customers_projection` — Shopify mirror with email, phone, firstName, lastName, tags, metafields, etc.
- `interactions`, `appointments`, `second_sight_intakes`, `credits_ledger` — all reference shopifyCustomerId
- `audit_log` — tracks all changes

### API routes
- `GET /api/crm/clients` — search by name/email/phone, filter by tag
- `GET /api/crm/clients/[id]` — full profile with orders, timeline, intakes, appointments
- `PATCH /api/crm/clients/[id]` — update core fields + metafields via Shopify Admin API
- `POST /api/crm/clients` — create in Shopify + projection

### Permissions
- `org:clients:merge` — owner + manager only

---

## What to build

### 1. New DB tables

Add to `src/lib/db/schema.ts`:

```
duplicate_candidates:
  id              uuid PK
  clientA         text (shopify_customer_id)
  clientB         text (shopify_customer_id)
  matchReason     text ('exact_email' | 'exact_phone' | 'fuzzy_name')
  confidence      decimal (0-1)
  status          text default 'pending' ('pending' | 'merged' | 'dismissed')
  createdAt       timestamp

client_links:
  id              uuid PK
  clientA         text
  clientB         text
  relationship    text ('family' | 'household' | 'corporate')
  createdBy       text (staff_id)
  createdAt       timestamp
```

### 2. Dedup scan Inngest function

Add to `src/lib/inngest/functions.ts`:

Cron: runs nightly (or on-demand trigger).

Logic:
1. Query all customers from customers_projection
2. Group by normalized email (lowercase, trim) → exact email matches
3. Group by normalized phone (digits only) → exact phone matches
4. For each match pair not already in duplicate_candidates: insert with confidence
   - exact_email: confidence 0.95
   - exact_phone: confidence 0.90
5. Skip pairs where either client has tag 'merged-into-*'

### 3. Duplicates API

**File:** `src/app/api/crm/clients/duplicates/route.ts`

```
GET /api/crm/clients/duplicates
Auth: org:clients:read
Returns: candidate pairs with both client summaries (name, email, phone, orderCount, totalSpent)

POST /api/crm/clients/duplicates/[id]/dismiss
Auth: org:clients:merge
Sets status = 'dismissed'
```

### 4. Merge API

**File:** `src/app/api/crm/clients/merge/route.ts`

```
POST /api/crm/clients/merge
Auth: org:clients:merge
Body: { primaryId, secondaryId }
```

Steps:
1. Re-link secondary's CRM data to primary:
   - `UPDATE interactions SET shopify_customer_id = primaryId WHERE = secondaryId`
   - Same for appointments, second_sight_intakes, credits_ledger
2. Merge tags: union of both → write to Shopify primary via Admin API
3. Archive secondary: add tag 'merged-into-[primaryId]'
4. Update duplicate_candidates status = 'merged'
5. Audit log with full merge details

### 5. Client link API

**File:** `src/app/api/crm/clients/[id]/link/route.ts`

```
POST /api/crm/clients/[id]/link
Auth: org:clients:update
Body: { linkedClientId, relationship }

GET /api/crm/clients/[id]/links
Auth: org:clients:read
Returns: linked clients with relationship type
```

### 6. Data normalization

Add to `POST /api/crm/clients` and `PATCH /api/crm/clients/[id]`:
- Phone: strip non-digits, prepend +1 if 10 digits (Canadian)
- Email: lowercase, trim
- Name: trim whitespace

**File:** `src/lib/crm/normalize.ts` — pure utility functions

### 7. Duplicates review page

**File:** `src/app/crm/clients/duplicates/page.tsx` — server component
**File:** `src/app/crm/clients/duplicates/DuplicatesClient.tsx` — client component

```
Layout:
  ┌──────────────────────────────────────────────────────────┐
  │ ← Clients    Potential Duplicates              [Scan Now]│
  ├──────────────────────────────────────────────────────────┤
  │ ┌─────────────────────┐  ┌─────────────────────┐        │
  │ │ Client A             │  │ Client B             │       │
  │ │ Name: John Smith     │  │ Name: Jon Smith      │       │
  │ │ Email: j@example.com │  │ Email: j@example.com │       │
  │ │ Orders: 5 ($2,400)   │  │ Orders: 1 ($150)     │       │
  │ │ Tags: [vip] [cult]   │  │ Tags: [first-time]   │       │
  │ └─────────────────────┘  └─────────────────────┘        │
  │ Match: exact_email (95%)     [Merge →] [Dismiss]        │
  ├──────────────────────────────────────────────────────────┤
  │ ... next pair ...                                        │
  └──────────────────────────────────────────────────────────┘

Merge button: picks primary (higher LTV), confirms, calls POST /api/crm/clients/merge
Dismiss button: calls POST dismiss
```

### 8. Client profile additions

On `ClientProfileClient.tsx`, add a "Related Clients" section in the right column:
- Shows linked clients (from client_links)
- "Link client" button → ClientPicker → select relationship type

---

## Done criteria

- [ ] duplicate_candidates + client_links tables in schema
- [ ] Inngest dedup scan function (exact email + exact phone matching)
- [ ] Duplicates review page with side-by-side comparison
- [ ] Merge action: re-links CRM data, merges tags, archives secondary
- [ ] Dismiss action on false positives
- [ ] Client linking (family/household/corporate)
- [ ] Data normalization on create/update (phone, email, name)
- [ ] Audit log on merge + link actions
- [ ] TypeScript compiles clean

---

## Out of scope
- Fuzzy name matching (V2 — needs Levenshtein/trigram index)
- Auto-merge at 95%+ confidence (V2 — needs more testing first)
- AI enrichment on client profile (spec 06)
- Incomplete profile flagging (V2)
