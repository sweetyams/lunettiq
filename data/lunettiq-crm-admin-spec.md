# Lunettiq — CRM Admin & Operations Specification

**Scope:** Everything required to operate the CRM after launch — setup, governance, staff lifecycle, integrations health, data lifecycle, business configuration, support workflows.
**Audience:** Owner (Benjamin), store managers, and the eventual ops person who takes over day-to-day administration.
**Status:** Draft v0.1
**Last updated:** April 2026

---

## Framing

The CRM spec defines what the system is. This document defines how it runs.

Most CRMs ship a beautiful client profile and a working segmentation engine, then die slowly from operational neglect — tags fragmenting into 400 near-duplicates, webhook failures going unnoticed, former employees still logging in three months after they left, no one knowing why a campaign didn't send. The admin layer isn't an afterthought. It's what separates a tool Benjamin uses in year three from one he's migrating off in year two.

This document covers ten areas:

1. Initial setup
2. Staff lifecycle
3. Location management
4. Tag and taxonomy governance
5. Business configuration
6. Integration health and monitoring
7. Data lifecycle and compliance
8. Rate limits, capacity, and cost controls
9. Support workflows
10. Change management and communication

---

## 1. Initial setup

### 1.1 First-run checklist

The CRM ships with a first-run flow (only the owner sees it). Completing it is prerequisite to any other staff logging in.

1. **Connect Shopify store** — OAuth flow, install custom app, confirm scopes
2. **Seed Shopify metafield definitions** — automated: runs a script that creates all metafield definitions defined in [CRM spec Section 5](lunettiq-crm-spec.md#5-data-model--shopify-first)
3. **Seed tag taxonomy** — starts with the default taxonomy, editable before locking in
4. **Create first location** — name, address, timezone, operating hours
5. **Invite store manager(s)** — email + role + location assignment
6. **Connect Klaviyo** — API key, confirm list mapping
7. **Connect booking system** (if used) — Calendly/Square OAuth
8. **Set business configuration** — tier pricing, credit rates, trade-in values (see Section 5)
9. **Confirm consent policy** — review default consent defaults, edit if needed
10. **Backfill customers** — import existing Shopify customers into the projection (automated after Shopify connection confirmed)

Progress saved per step. Can be resumed. Locked only when all required steps are complete.

### 1.2 Migration from existing systems

Benjamin has customer data today — in Shopify, likely in a notes field, maybe in a spreadsheet or Notion database. Migration is handled in three phases.

**Phase 1: Shopify customers sync automatically.** The projection backfill runs on initial connection. All existing Shopify customers become CRM clients on day one. No manual action.

**Phase 2: Bulk notes import.** If historical notes exist (spreadsheet, Notion, etc.), a CSV import tool at `/settings/import` accepts:
- Email (match key)
- Note text
- Note date (optional, defaults to import date)
- Note author (optional, defaults to "Legacy import")

Imported notes appear in the timeline tagged as `imported`, visually distinct from native entries.

**Phase 3: Manual enrichment.** Face shapes, fit measurements, Rx data often don't exist in structured form. These get filled in over time as clients return. No bulk import offered — the data quality isn't there to support it.

### 1.3 Training mode

For the first two weeks after launch, or whenever new staff join, the app runs in "training mode" for that user:
- Confirmation modals on all destructive actions
- Inline help text on key fields
- A guided tour of the client profile, interaction creation, and Second Sight intake
- Toggle off once the user is comfortable (or auto-off after 14 days)

Not a feature flag on the whole app — it's per-user, stored on Clerk public metadata (`training_mode: true`).

---

## 2. Staff lifecycle

### 2.1 Invitation

Admin invite flow:
1. Owner or manager goes to `/settings/staff`
2. Enters email, role (from dropdown), assigned locations (multi-select, scoped to their own permissions)
3. Optional: adds a personal note to the invitation email
4. Clerk sends the invite
5. New user accepts, completes profile (name, photo, phone for MFA)
6. Lands on their role's default page

Invitations expire after 7 days. Unaccepted invites visible at `/settings/staff` with resend option.

### 2.2 Active staff management

`/settings/staff` shows the active roster:
- Name, email, role, locations, last active, MFA status
- Filters by role and location
- Actions per row: edit role, edit locations, suspend, offboard

Bulk actions: change location assignment for multiple users at once (e.g., when a store opens and three SAs transfer).

### 2.3 Role changes

Changing a role is audited (who changed it, from what to what, when). No approval flow in V1 — owner and manager can do this directly. In V2, consider a two-person rule for promoting someone to manager.

### 2.4 Suspend vs. offboard

**Suspend** is temporary. Parental leave, medical leave, sabbatical. User's sessions are invalidated immediately, Clerk account remains, data access paused. Reinstating is one click.

**Offboard** is permanent.
- Clerk account disabled (cannot re-invite with same email without explicit override)
- All active sessions terminated
- In-progress custom designs transferred to manager (or explicitly archived)
- In-progress Second Sight intakes transferred to the queue under "unassigned"
- Scheduled appointments reassigned to the location's default staff pool
- Audit log entries preserved intact (never deleted — they're the historical record)
- A final PDF report of the staff member's activity (interactions logged, intakes processed, clients served) can be generated for performance reviews or HR records

Offboarding is a two-step confirmation. Shows exactly what will happen before it happens.

### 2.5 Password and MFA recovery

Handled by Clerk's native flows. No custom UI. Owner has emergency override ability:
- Force password reset on any user
- Temporarily disable MFA for recovery (logs to audit, expires in 1 hour)

### 2.6 Session management

`/settings/staff/[userId]/sessions` shows active sessions:
- Device, surface (web/tablet/phone), location, last active, IP country
- Action: revoke session

Useful when a device is lost or a staff member reports suspicious activity.

---

## 3. Location management

### 3.1 Creating a location

`/settings/locations` → "New location"

Required fields:
- Handle (URL-safe, permanent — used in tags and references)
- Display name
- Address
- Timezone
- Operating hours (per day, supports split schedules for lunch closures)
- Shopify location link (one-to-one with a Shopify Location — inventory is Shopify-managed)
- Primary contact (phone, email)

Optional:
- Photo for the location switcher
- Location-specific tagline or note (shown in UI context)
- Default appointment types offered here

### 3.2 Editing a location

Handle is immutable after creation (would break audit trail, tag references, etc.). Everything else editable.

Renaming display name updates everywhere immediately. Audit log preserves the old name for historical entries.

### 3.3 Closing / archiving a location

If a location closes:
- Mark as `archived` (not deleted — audit history references it)
- Staff assigned only to it must be reassigned or offboarded before archiving
- Open appointments at the location must be rescheduled or cancelled
- Open custom designs reassigned
- Inventory transferred in Shopify first, then the archive action proceeds

Archived locations disappear from active filters but remain visible in historical reports.

### 3.4 Cross-location rules

- Clients belong to the brand, not a location (home_location is a preference)
- Orders always belong to the location where they were placed or fulfilled
- Appointments belong to their location
- Interactions belong to the location where they were logged
- Staff can serve clients from any location they can access, regardless of home_location

---

## 4. Tag and taxonomy governance

Tags are where CRMs rot. A disciplined taxonomy is half the battle.

### 4.1 Tag settings page

`/settings/tags` — manager and owner access.

Lists all tags with:
- Name
- Category (Behavioural / Commercial / Relational / Product / Loyalty / Location / Custom)
- Count of customers tagged
- Created by, created date
- Last applied date
- Actions: rename, retire, merge

### 4.2 Tag creation rules

**App-enforced naming conventions:**
- Lowercase only
- Hyphens instead of spaces
- No special characters
- Max 30 characters
- Must include a category prefix for custom tags (e.g., `custom:wedding-season-2026`)

Tags in the seeded taxonomy (Section 4.4) skip the prefix rule. New custom tags require the prefix.

### 4.3 Preventing sprawl

**Suggestion matching on create.** When a user types a new tag, the system checks against existing tags (fuzzy match, Levenshtein distance). If there's a likely match, it suggests using that instead of creating a duplicate.

**Quarterly tag review.** An owner-only report lists tags applied to fewer than 5 customers, unused in the last 90 days, or similar-to-each-other. Action options: merge, retire, keep.

**Locked categories.** Core categories (behavioural, commercial, loyalty) cannot have new tags added by anyone below owner level. Custom and relational are open to managers. SAs can only apply existing tags, never create.

### 4.4 Seeded taxonomy

Editable but not deletable (these are system tags):

```
Behavioural:    first-time-buyer, repeat-buyer, high-frequency, dormant, churned-membership
Commercial:     high-ltv, at-risk, discount-sensitive
Relational:     press, industry, vip, friends-and-family
Product:        rx-wearer, sun-only, collector
Loyalty:        member-essential, member-cult, member-vault
Location:       home-[location-handle] (auto-created per location)
```

### 4.5 Rename and retire

**Rename** — propagates as a bulk Shopify customer update. Queued (rate-limit aware). Shows progress. Old name preserved in audit log.

**Retire** — tag is soft-removed from the active list but remains on historical customer records. No new customers can be tagged with a retired tag. Can be un-retired by owner.

**Merge** — "Merge tag A into tag B." All customers tagged A get tagged B, tag A is retired. Audited with full diff.

### 4.6 Auto-tagging rules (V2)

At `/settings/tags/rules`:
- "Auto-add `high-ltv` when customer LTV crosses $2000"
- "Auto-add `dormant` when last order > 12 months ago"
- "Auto-remove `first-time-buyer` after second order"

Rules run nightly. Changes go through the Shopify write layer and log to audit as a system actor.

---

## 5. Business configuration

Business logic that shouldn't require a deploy to change.

### 5.1 Membership tier configuration

`/settings/business/membership` — owner only.

Editable per tier (Essential, CULT, VAULT):
- Monthly fee
- Annual fee
- Monthly credit amount
- Lens refresh credit amount
- Lens refresh frequency (per N months)
- Trade-in percentage for Second Sight
- Frame rotation eligibility (yes/no, frequency)
- Birthday credit amount
- Member-only discount percentages

Changing these affects future billings and credit issuances only. Historical records remain at the value that was live when they were issued. Every change audited with before/after.

### 5.2 Second Sight value table

`/settings/business/second-sight`:

Trade-in credit calculation:
```
credit = original_msrp × grade_multiplier × tier_multiplier
```

**Grade multipliers** (editable):
- Grade A: 0.50
- Grade B: 0.35
- Grade C: 0.10 (recycling credit only)

**Tier multipliers** (editable):
- Non-member: 1.00 × 0.20 (20% of grade value)
- Essential: 1.00 × 0.20
- CULT: 1.00 × 0.30
- VAULT: 1.00 × 0.375

Preview calculator at the top of the page: "A Grade B frame with $325 MSRP for a CULT member = $34.13." Updates as values change.

### 5.3 Credit expiration and cancellation policy

Editable policy for what happens to credits when a membership cancels:
- Grace period (default: 60 days to spend remaining credits)
- After grace: credits expire (default) or roll over to non-member balance (configurable)

### 5.4 Appointment types and durations

`/settings/business/appointments`:

List of appointment types with:
- Name
- Duration (minutes)
- Required role (optician-only, any staff)
- Buffer time before/after
- Default location assignment or per-location

Used by the booking system (V2) to create bookable slots.

### 5.5 Consent defaults

`/settings/business/consent`:

- Default email opt-in state at checkout (Shopify-native)
- Default SMS opt-in state at checkout
- Account creation marketing language
- In-store consent capture script (copy the SA reads when asking)
- Minimum age for marketing consent (13, 16, 18 — Quebec Law 25 has specific rules for minors)

---

## 6. Integration health and monitoring

Benjamin shouldn't discover Klaviyo sync has been broken for three days by noticing a campaign didn't send.

### 6.1 Integration dashboard

`/settings/integrations/health` — owner and manager access.

For each integration (Shopify, Klaviyo, Clerk, R2, booking system, SMS provider):

- Current status (green / amber / red)
- Last successful interaction timestamp
- Failure count (last hour, last 24 hours, last 7 days)
- Relevant rate limit consumption (e.g., Shopify API budget %)

### 6.2 Health checks

Background job runs every 5 minutes:

- **Shopify** — ping the Admin API with a cheap query, measure latency, record rate-limit headers
- **Klaviyo** — ping the accounts endpoint
- **Clerk** — ping the user count endpoint
- **R2** — check object write + read round-trip with a tiny file
- **Booking system** — if API has a health endpoint, use it; otherwise measure last successful sync

Failures logged to `integration_health_events` table. Three consecutive failures = amber. Five = red.

### 6.3 Alerting

When a status transitions to amber or red:
- Email to owner and any admin-tier manager
- In-app banner for affected roles
- Webhook out to whatever monitoring tool is used (Slack, Discord, PagerDuty)

Quiet hours configurable per channel — no 3am alerts to the owner's personal email for non-critical amber events.

### 6.4 Sync event log

`/settings/integrations/sync-log`:

Every webhook received, every outbound API call that matters:
- Source (Shopify customer.update, Klaviyo unsubscribe, etc.)
- Timestamp
- Status (success, retried, failed, dropped)
- Payload ID (for correlation)
- Error message if failed

Searchable and exportable. First place to look when something's off.

### 6.5 Manual re-sync tools

For when things go sideways, quick-fix tools accessible to managers and owner:

- **Re-sync customer** — at the client profile, a "Re-sync from Shopify" button pulls fresh data and rebuilds the projection row
- **Replay webhook** — in the sync log, click "replay" on any recent event to re-process it
- **Rebuild segment** — at a segment, force a fresh evaluation against projection
- **Reconcile credits ledger** — runs the nightly drift check on demand for a specific customer

Each manual operation audited.

---

## 7. Data lifecycle and compliance

### 7.1 Customer data requests

Quebec Law 25 and PIPEDA both grant customers rights to access, correct, and delete their data. The CRM must handle these requests in a defined timeline (30 days max for access, reasonable time for deletion).

**Access request flow:**
1. Customer emails privacy@lunettiq.com or uses a form on the storefront
2. Owner sees the request in `/settings/privacy/requests`
3. One-click "Generate customer data export" produces:
   - A PDF summary (human-readable)
   - A ZIP with all raw data (JSON export of Shopify + CRM, all attachment files from R2)
4. Reviewed, sent to customer within the legal window
5. Request logged with completion date

**Correction request:**
- Customer specifies what should be changed
- Owner or manager makes the change in the normal CRM flow
- System logs the correction as triggered by a data request

**Deletion request (right to be forgotten):**
- Two-step confirmation required
- All CRM-owned data for the customer: hard-deleted after 30-day hold
- Shopify customer: deleted via Admin API (Shopify retains legally required records — orders for tax purposes — which is PIPEDA-compliant)
- All R2 files (prescription PDFs, intake photos, reference photos from designs): deleted
- Audit log entries: anonymized (staff actions preserved, customer identifier replaced with `[deleted customer]`)
- Customer record on Klaviyo: deleted via API
- Exception: if there's an active legal matter, deletion paused with a documented hold

### 7.2 Data retention policy

`/settings/privacy/retention`:

Default retention windows (editable by owner):
- Inactive customer data (no orders, no interactions): 3 years after last activity, then auto-archive (anonymized)
- Audit log: 7 years (legal minimum for financial records)
- Consent audit: 7 years
- Interaction timeline: permanent while customer is active, archived when customer is archived
- Intake photos and prescription files: 7 years (medical record retention in Quebec)
- Old sessions and auth logs: 1 year

Auto-archive runs monthly. Anonymized customers appear in aggregates (LTV cohorts, reports) but can't be identified individually.

### 7.3 Backup policy

Postgres:
- Point-in-time recovery enabled (Neon supports 7 days)
- Nightly snapshot to separate storage, retained 90 days
- Monthly snapshot retained 7 years (for regulatory recovery only)

R2:
- Versioning enabled on critical buckets (prescription files)
- 30-day retention on deleted objects

Restore procedure documented in `/settings/privacy/restore-runbook` — not a UI action (too dangerous), but a documented manual process with contact points.

### 7.4 Data export (non-request)

`/settings/privacy/exports`:

Owner can generate on-demand exports:
- Full customer list + metadata (CSV)
- Full interaction history (CSV)
- Full credits ledger (CSV)
- Audit log for a date range (CSV)

For routine accounting and regulatory purposes. Downloads expire after 7 days.

---

## 8. Rate limits, capacity, and cost controls

Not glamorous. Essential.

### 8.1 Shopify API budget

`/settings/capacity/shopify`:

- Current plan (Standard vs. Plus)
- Current request rate (real-time graph)
- 24-hour peak
- Estimated headroom before rate-limit throttling

Shows projected upgrade trigger: "At current growth, you'll hit Standard plan limits in approximately 4 months."

### 8.2 Klaviyo plan usage

- Current plan tier
- Active profiles (against plan limit)
- SMS sends this month
- Email sends this month
- Projected next-tier cost

### 8.3 R2 storage

- Total stored
- Growth rate (last 30 days)
- Cost estimate per month
- Largest files by size
- Cleanup suggestions (e.g., "Delete 40 intake photos older than 3 years for $0.12/mo savings")

### 8.4 Postgres capacity (Neon)

- Database size
- Connection pool usage
- Slowest queries (last 24h)
- Upgrade recommendations

### 8.5 Cost rollup

`/settings/capacity/costs`:

Monthly operational cost estimate:
- Vercel (hosting)
- Neon (Postgres)
- Upstash (Redis)
- Clerk (auth)
- Klaviyo (messaging)
- R2 (storage)
- Sentry, Axiom (observability)

Growth projection for next 12 months at current trajectory. This isn't accounting-grade — it's a sanity check so a surprise invoice doesn't happen.

---

## 9. Support workflows

When something goes wrong, what's the path?

### 9.1 In-app support

Every screen has a small "?" in the corner. Opens a panel with:
- Screen-specific help content
- Search across help articles
- "Report a problem" form that captures current URL, user agent, session ID, and user's description

Reports route to a support inbox (email or dedicated channel). Logged to `support_tickets` table for the owner's review.

### 9.2 Common support scenarios and their runbooks

Documented in `/settings/support/runbooks`. Plain-language guides for:

- "A client's credit balance is wrong" → reconcile steps, when to use manual adjustment, when to escalate
- "A segment has wrong member count" → force rebuild, check webhook delay, verify rules
- "An SA can't see a client" → check location scope, check client home_location, check Clerk session
- "Shopify webhook is delayed or missing" → manual re-sync procedure
- "A custom design is stuck in review" → how to unblock, owner re-approve
- "Customer says they didn't get a campaign email" → check Klaviyo logs, consent state, suppression lists

Each runbook is editable by owner and managers. Living documents, not static.

### 9.3 Escalation paths

For issues the runbooks can't solve:
- Tier 1: Manager at the location
- Tier 2: Owner
- Tier 3: External support (developer / agency) — documented contact, expected response times

### 9.4 Feedback collection

A lightweight feedback tool inside the CRM, accessible from any page:
- "Report a bug"
- "Suggest an improvement"
- "This is confusing"

Feedback tagged with screen, role, timestamp. Owner reviews monthly. Not a formal product management system, but enough signal to know what's working and what isn't.

---

## 10. Change management and communication

### 10.1 Release notes

When the CRM updates (feature additions, bug fixes, policy changes), a release note is published in-app at `/what's-new`.

Each release:
- Version number
- Date
- Summary (plain language)
- Who's affected
- Required actions, if any

New releases show a non-intrusive indicator on the user's avatar for one week or until dismissed.

### 10.2 Policy change communication

When something that affects staff behaviour changes (tag taxonomy updated, consent policy revised, new role introduced), the owner or manager can post a **pinned announcement** that appears on every user's dashboard until acknowledged.

Acknowledgements logged to audit (proves staff saw the change).

### 10.3 Training materials

`/settings/training` — owner and manager access, but materials visible to all staff:

- Short videos for key workflows (Second Sight intake, custom design draft, client creation)
- PDF quick-reference cards printable for the store
- Role-specific onboarding checklists

Updated as the CRM evolves. New staff start their onboarding checklist automatically.

### 10.4 Known issues register

`/settings/support/known-issues`:

Public (to staff) list of known bugs, workarounds, expected resolution. Reduces duplicate support reports and builds trust that issues are tracked.

---

## Summary: what to build for V1 admin surface

Minimum viable admin for launch:

1. First-run setup flow (Section 1.1)
2. Staff invite/suspend/offboard (Section 2)
3. Single location creation and edit (Section 3)
4. Tag settings with naming rules (Section 4.1–4.5)
5. Business configuration screens for membership, Second Sight, consent (Section 5)
6. Integration health dashboard (Section 6.1–6.2)
7. Manual re-sync tools (Section 6.5)
8. Customer data request flow (Section 7.1)
9. Cost/capacity rollup, read-only (Section 8.5)
10. Runbooks for common issues (Section 9.2 — just the first 3)

Defer to V2:
- Tag auto-rules (4.6)
- Detailed capacity forecasting (8.1–8.4)
- Full training materials system (10.3)
- Feedback collection tooling (9.4)
- Release notes system (10.1)

Everything between first-run and day-one-hundred operates — that's the V1 bar.

---

*Cross-reference: CRM spec `lunettiq-crm-spec.md` · Clerk permissions `lunettiq-clerk-permissions.md`*
