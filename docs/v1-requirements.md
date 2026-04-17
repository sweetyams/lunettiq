# Lunettiq CRM — V1 Feature Requirements

**Date:** April 16, 2026
**Scope:** 6 feature areas derived from CRM spec, admin spec, clerk permissions, and loyalty program specs.
**Status:** DRAFT — awaiting sign-off before implementation

---

## Feature 1: Appointments + Calendar

### Exists today
- Full API layer: CRUD, slots endpoint, overlap check, status transitions, audit log
- Basic `new/page.tsx` form (title, client ID, datetime-local, notes)
- DB schema: appointments table with status enum, staffId, locationId, timestamps

### What to build

**Week calendar view** (`/crm/appointments`)
- 7-day grid, 9AM–7PM rows, events positioned by start/end time
- Status colors: scheduled=grey, confirmed=blue, completed=green, cancelled=red, no_show=amber
- Prev/next/today navigation
- Click empty slot → open create panel. Click event → open detail panel.

**Staff filter**
- Pill toggles above calendar: "All" + individual staff with avatars
- Filters the GET /api/crm/appointments query by staffId
- Needs a lighter staff endpoint (current one requires org:settings:staff — too restrictive)

**Side panel: create appointment**
- Title input, client search (existing ClientPicker), staff picker, time slot picker (from slots API), notes
- Date pre-filled from clicked slot or date picker fallback

**Side panel: view/edit appointment**
- Title, client (linked), date/time, status badge, notes
- Status transition buttons: scheduled→confirm/cancel, confirmed→complete/no_show/cancel

**Architecture**
- Server component page.tsx fetches initial week → passes to AppointmentsClient.tsx
- Client component handles navigation, filtering, panel state
- Mutations via fetch to existing API routes (no server actions — none exist in codebase)

### New API needed
- `GET /api/crm/staff/list` — lightweight (id, name, imageUrl only), gated on org:appointments:read

### Open questions
1. Keep `new/page.tsx` as standalone route for deep links from client profiles?

---

## Feature 2: Role Management + Staff Lifecycle

### Exists today
- Read-only staff table at `/crm/settings/staff` (fetches from Clerk API)
- Permissions enforced in app code via `lib/crm/permissions.ts` (5 roles: owner, manager, optician, sa, read_only)
- Staff API returns id/name/email/role/locationIds/imageUrl

### What to build

**Invite staff** (`/crm/settings/staff`)
- Form: email, role dropdown (owner/manager/optician/sa/read_only), location multi-select
- Calls Clerk `createOrganizationInvitation()` with role + location metadata on publicMetadata
- Pending invites list with resend/revoke actions
- Invitation expires after 7 days (admin spec §2.1)

**Edit role**
- Per-row action on staff table. Role dropdown. Two-step confirm.
- Writes to Clerk user publicMetadata.role
- Audit logged with before/after

**Edit locations**
- Per-row multi-select for location_ids
- Writes to Clerk user publicMetadata.location_ids

**Suspend**
- Temporary disable. Invalidates sessions via Clerk API.
- Visual indicator on staff list. One-click reinstate.

**Offboard**
- Permanent. Two-step confirmation showing consequences:
  - Scheduled appointments → reassigned to location default pool
  - Open intakes → moved to unassigned queue
  - Open custom designs → transferred to manager or archived
- Clerk account disabled. Audit log preserved.

**Staff list upgrades**
- Filters by role and location
- Show last active, MFA status columns
- Bulk location reassignment

### New API routes
- `POST /api/crm/staff/invite`
- `PATCH /api/crm/staff/[id]` (role, locations)
- `POST /api/crm/staff/[id]/suspend`
- `POST /api/crm/staff/[id]/offboard`

### Spec references
- Admin spec §2 (full staff lifecycle)
- Clerk permissions spec §3 (role→permission matrix)
- Clerk permissions spec §4 (location scoping via publicMetadata)
- Clerk permissions spec §7 (invitation flow)

---

## Feature 3: Product Recommendations + Virtual Try-On

### Exists today
- Products grid with search/filter by type/vendor
- Product detail with image gallery, variants table, "Recommend to Client" (creates interaction via ClientPicker)
- `@mediapipe/tasks-vision` installed, `lib/tryon/face-tracker.ts` exists (storefront)
- Recommend API creates an interaction of type `product_recommendation`

### Tier 1: Smart Recommendations (V1)

**Recommend from client profile**
- "Recommend Product" button on client profile → product search modal
- Search by name, filter by type/vendor, show price/stock
- Select → creates interaction + shows in timeline

**Smart suggestions on client profile**
- "Suggested for you" section on client profile
- Algorithm: match client's face_shape, frame_width_mm, preferred materials/colours (from preferences_derived + metafields) against product tags/metafields
- Top 5-10 matches with match reason ("Matches your face shape", "Similar to previous purchase")
- Exclude products client already owns (from orders_projection line items)
- Show "Previously purchased" badge on owned products

**Recommend from product page**
- Already exists. Keep as-is.

### Tier 2: Virtual Try-On + Engagement System (V1.5/V2)

**Virtual try-on in CRM**
- Bring existing MediaPipe face tracker into CRM context
- Overlay frame images on webcam feed
- Save try-on screenshots to client profile

**Try-on session flow**
- Client tries on frames → likes/dislikes each → builds shortlist
- Shortlist saved as interaction or in new `product_sentiments` table

**Likes/dislikes tracking**
- Per-client product sentiment (liked/disliked/tried_on/purchased)
- Feeds back into recommendation algorithm

**Auto-tagging + Klaviyo events**
- When client likes products in a category → auto-tag (e.g., product:sun-only)
- Push tags to Shopify → syncs to Klaviyo for targeted campaigns
- Fire Klaviyo events on: try-on completion, product like, recommendation sent

### DB changes
- New table `product_sentiments` (client, product, sentiment enum, timestamp, staffId)
- Or extend interactions metadata — TBD in design phase

### Open questions
1. Tier 2 in V1 or fast follow? Infrastructure exists (MediaPipe, face-tracker.ts).
2. LLM provider for "AI stylist" suggestions? Or rule-based only for V1?

---

## Feature 4: AI-Powered Segmentation

### Exists today
- Basic rule builder with 9 fields (order_count, total_spent, name, email, phone, tags, email/SMS consent)
- AND/OR logic, preview count, saves to segments table
- SQL evaluation against customers_projection

### What to build

**Expanded rule builder**
- Add fields: last_order_date, days_since_last_order, created_at, home_location, face_shape, rx_on_file, membership tier (from tags), credit_balance (from metafields), has_appointment, interaction_count, last_interaction_date, product_type_purchased, vendor_purchased, average_order_value
- Date-range qualifiers: "spent > $500 in the last 90 days"
- Requires joining across projection tables + CRM tables (interactions, appointments, credits_ledger)

**AI segment suggestions**
- "AI Suggest" button on segments page
- Sends aggregated data profile to LLM (NOT raw PII): LTV distribution, order frequency histogram, tag frequency, dormancy buckets, tier breakdown, seasonal purchase patterns
- AI returns 3-5 suggested segments with: name, description, rule set, estimated size
- User can accept (creates segment), edit, or reject each suggestion

**AI analysis on demand**
- "Analyze" mode: user picks date range or "all time"
- AI returns insights: "47 clients haven't purchased in 12+ months but spent >$1000 — consider win-back"
- Each insight has a "Create segment from this" action button

**Segment actions**
- View member list
- Export CSV
- Push to Klaviyo as a list (CRM spec §10.4)
- Bulk tag (writes to Shopify, audited, rate-limit aware)

**Scheduled re-evaluation**
- Inngest job: nightly segment member count refresh

### New API routes
- `POST /api/crm/segments/ai-suggest` — sends aggregated stats, returns suggestions
- `POST /api/crm/segments/ai-analyze` — date-scoped analysis
- `GET /api/crm/segments/[id]/members` — paginated member list

### Open questions
1. LLM provider: OpenAI (GPT-4o), Anthropic (Claude), or Vercel AI SDK wrapping either?

---

## Feature 5: Client Sanitization + Dedup + AI Enrichment

### Exists today
- Client list with search/sort/tag filter/pagination
- Client profile with inline editing, tags, fit profile, preferences, consent, timeline
- Client API: GET list, GET/PATCH single, POST create (writes to Shopify + projection)
- org:clients:merge permission exists in permissions.ts but no merge UI or API

### What to build

**Duplicate detection**
- Background job (Inngest): scan customers_projection for likely duplicates
- Match on: exact email, exact phone, fuzzy name (Levenshtein), same email domain + similar name
- Store results in new `duplicate_candidates` table (pair of IDs, match reason, confidence score, status: pending/merged/dismissed)
- Surface on client list: banner "X potential duplicates found" → link to review queue

**Duplicate review + merge**
- `/crm/clients/duplicates` — review queue showing candidate pairs
- Side-by-side comparison: name, email, phone, orders, LTV, tags, interactions
- Actions: Merge (pick primary, absorb secondary), Dismiss (mark as not-duplicate)
- Merge logic:
  - Primary keeps their Shopify customer ID
  - Secondary's CRM data (interactions, appointments, intakes, credits) re-linked to primary
  - Secondary's Shopify tags merged into primary
  - Secondary soft-deleted (archived, not destroyed — preserves original source)
  - Audit log records full merge with both IDs

**Auto-merge**
- When confidence > 95% (exact email + exact name match): auto-merge with audit trail
- Configurable threshold in settings

**Client linking (without merge)**
- Link related clients: family members, same household, corporate accounts
- New `client_links` table (clientA, clientB, relationship: family/household/corporate, createdBy)
- Visible on client profile: "Related clients" section

**Data sanitization**
- On client create/update: normalize phone (E.164), normalize email (lowercase, trim), normalize name (title case)
- Flag incomplete profiles: missing email, missing phone, no orders, no tags
- Surface on dashboard or client list: "X profiles need attention"

**AI enrichment**
- "Enrich" button on client profile
- AI analyzes: purchase history, interaction timeline, preferences, tags
- Suggests: missing tags, tier recommendation, churn risk, next-best-action
- Staff can accept/reject each suggestion

### DB changes
- New table: `duplicate_candidates` (id, clientA, clientB, matchReason, confidence, status, createdAt)
- New table: `client_links` (id, clientA, clientB, relationship, createdBy, createdAt)

### New API routes
- `GET /api/crm/clients/duplicates` — candidate pairs
- `POST /api/crm/clients/merge` — execute merge
- `POST /api/crm/clients/[id]/link` — create link
- `POST /api/crm/clients/[id]/enrich` — AI enrichment

---

## Feature 6: VIP Loyalty System

### Exists today
- DB: credits_ledger table with transaction types (issued_membership, issued_birthday, issued_manual, issued_second_sight, redeemed_order, expired, adjustment)
- Shopify metafields defined: membership_status, credits_balance, member_since, next_renewal, last_rotation_used, last_lens_refresh
- Tier stored as Shopify customer tags: member-essential, member-cult, member-vault
- Client profile shows tags (including tier) but no dedicated membership UI

### What to build (from loyalty program spec)

**Membership display on client profile**
- Tier badge (Essential/CULT/VAULT) with visual hierarchy
- Credits balance (running total from ledger)
- Member since date, next renewal date
- Lens refresh status (used/available, last used date)
- Frame rotation eligibility (CULT: 25% off swap, VAULT: free swap)

**Credits ledger view**
- On client profile: transaction history table
- Columns: date, type, amount (+/-), running balance, reason, staff
- Filter by type, date range

**Credits adjustment**
- Manual adjust button (requires org:credits:adjust permission)
- Amount, reason (required), confirmation modal
- Creates ledger entry + updates Shopify metafield + audit log

**Tier management**
- Change tier action on client profile (requires org:membership:update_tier)
- Adds/removes tier tag on Shopify customer
- Adjusts credit issuance rate going forward
- Audit logged with before/after tier

**Membership status controls**
- Pause (up to 2 months, 1x per 12 months per spec)
- Cancel (60-day grace period to spend remaining credits, then expire)
- Reactivate
- All status changes → Shopify metafield update + audit log

**Automated credit issuance (Inngest jobs)**
- Monthly: issue credits based on tier ($15 Essential, $30 CULT, $60 VAULT)
- Birthday: issue birthday credit ($20 Essential, scaled for higher tiers)
- Lens refresh: annual $40 credit for CULT/VAULT

**Second Sight integration**
- Trade-in credit calculated: original_msrp × grade_multiplier × tier_multiplier
- Grade multipliers: A=0.50, B=0.35, C=0.10
- Tier multipliers: non-member=0.20, Essential=0.20, CULT=0.30, VAULT=0.375
- Credit issued to ledger on intake approval

**Nightly reconciliation**
- Inngest job: sum credits_ledger per customer vs Shopify metafield credits_balance
- Log drift, auto-correct if within threshold, flag for manual review if large

### New API routes
- `GET /api/crm/clients/[id]/credits` — ledger entries
- `POST /api/crm/clients/[id]/credits/adjust` — manual adjustment
- `PATCH /api/crm/clients/[id]/membership` — tier change, pause, cancel, reactivate

### New components
- MembershipCard (tier badge, credits, renewal, perks status)
- CreditsLedger (transaction table with filters)
- CreditAdjustModal (amount, reason, confirm)
- TierChangeModal (select tier, confirm consequences)

---

## Summary: Implementation Order

| Priority | Feature | Complexity | Dependencies |
|---|---|---|---|
| 1 | Appointments calendar | Medium | Lighter staff endpoint |
| 2 | Role management | Medium | Clerk API integration |
| 3 | Client sanitization + dedup | Medium-High | Inngest job, new tables |
| 4 | Loyalty system | High | Credits ledger, Inngest jobs, Shopify metafield writes |
| 5 | Product recommendations (Tier 1) | Medium | Preferences data |
| 6 | AI segmentation | High | LLM provider choice |
| 7 | Virtual try-on (Tier 2) | High | MediaPipe in CRM context |

## Decisions — RESOLVED

1. **Staff API**: Use Clerk.com permissions natively (not app-code workaround) ✅
2. **LLM provider**: Anthropic Claude ✅
3. **Virtual try-on**: Fast follow (not V1) ✅
4. **Auto-merge threshold**: 95% confidence default ✅
