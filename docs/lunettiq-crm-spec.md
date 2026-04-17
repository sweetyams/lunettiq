# Lunettiq — Client Book (CRM) Specification

**Stack:** Next.js 14 (App Router) · Shopify Admin API + Webhooks · Postgres (Neon) · Redis (Upstash) · Clerk · Vercel · Expo (React Native) · Klaviyo
**Status:** Draft v0.3 — pre-development spec
**Last updated:** April 2026

---

## Framing

Shopify is the source of truth. Full stop. The CRM is a brand-grade UI and a workflow engine on top of Shopify's data model. Any field that Shopify can hold, Shopify holds. The CRM's own database exists only for things Shopify genuinely cannot model cleanly, plus a read cache that keeps the surfaces fast.

Three surfaces share the data layer: the storefront (customer-facing), the CRM web app (owner + managers), and the mobile apps (SA tablet + phone). All three read the same data. Writes always flow through Shopify. Drift is prevented by making the flow one-way.

The scope expanded beyond the original brief. This version covers: preferences, product catalogue consumption across surfaces, shared session/login across storefront + CRM + apps, email list management, SMS, and a database architecture that makes all of it work.

---

## Contents

1. [Principles](#1-principles)
2. [Roles and device profiles](#2-roles-and-device-profiles)
3. [Scope by phase](#3-scope-by-phase)
4. [Database architecture](#4-database-architecture)
5. [Data model — Shopify first](#5-data-model--shopify-first)
6. [CRM-owned data (thin layer)](#6-crm-owned-data-thin-layer)
7. [Preferences model](#7-preferences-model)
8. [Product catalogue — shared across surfaces](#8-product-catalogue--shared-across-surfaces)
9. [Shared authentication and identity](#9-shared-authentication-and-identity)
10. [Email and SMS list management](#10-email-and-sms-list-management)
11. [Information architecture — web](#11-information-architecture--web)
12. [Client profile — web](#12-client-profile--web)
13. [Segmentation engine](#13-segmentation-engine)
14. [Interaction timeline](#14-interaction-timeline)
15. [Second Sight module](#15-second-sight-module)
16. [Membership module](#16-membership-module)
17. [Appointments module](#17-appointments-module)
18. [Custom frame design module](#18-custom-frame-design-module)
19. [Mobile app — SA tablet and phone](#19-mobile-app--sa-tablet-and-phone)
20. [Multi-location model](#20-multi-location-model)
21. [Permissions and audit](#21-permissions-and-audit)
22. [Reporting and exports](#22-reporting-and-exports)
23. [Tech architecture](#23-tech-architecture)
24. [Open decisions](#24-open-decisions)

---

## 1. Principles

- **Shopify first.** Before adding a field to the CRM database, ask whether a metafield, metaobject, or tag can hold it. Default answer is yes.
- **Writes always flow through Shopify.** No surface writes to the Postgres cache directly. The cache is rebuilt from webhooks.
- **Reads are local.** Every surface reads from its local cache (Postgres for web, SQLite for mobile). Shopify Admin API is never called during a user-facing page render.
- **One client, one conversation.** The UI optimizes for the SA or manager with a specific client in mind. Batch operations exist but are secondary.
- **Three surfaces, one data layer.** Web (management), tablet (fitting room), phone (between-appointment). Designed for their form factor.
- **Every write is audited.** Who, what, when, from which surface, at which location.
- **Offline-tolerant on mobile.** Tablet and phone work without connectivity. Sync on reconnect.

---

## 2. Roles and device profiles

| Role | Primary device | Primary job |
|---|---|---|
| **Owner** (Benjamin) | Web | Brand strategy, full access, reporting, catalogue decisions, custom frame approvals |
| **Store manager** | Web + tablet | Run a location, manage staff, handle escalations, approve Second Sight grades, review custom orders |
| **Sales associate** | Tablet + phone | Client-facing work: lookup, intake, fitting, Second Sight, custom design drafts, notes |
| **Customer** (end user) | Storefront + account | Browse, purchase, manage preferences, view order history, manage membership, opt in/out of marketing |
| **Read-only** (future) | Web | View data, export reports, no writes |

### 2.1 Default landings

| Role | Default landing |
|---|---|
| Owner | `/dashboard` — cross-location overview |
| Store manager | `/location/[id]` — their location |
| SA (tablet/phone) | Client search with recent 5 pinned |
| Customer | `/account` (storefront) |
| Read-only | `/clients` |

---

## 3. Scope by phase

### V1 — the foundation (10–12 weeks)

- Database architecture: Shopify + Postgres cache + webhook pipeline
- Shopify data model: metafields, metaobjects, customer tags, draft orders for custom frames
- Web app: client list, client profile, interaction timeline, manual segmentation, Second Sight intake, membership display, appointment records, product catalogue browser
- Tablet app: client search + creation, profile view, photo capture, Second Sight intake, note-taking, product browser
- Shared login (Clerk + Shopify Customer Accounts) across storefront, CRM, and mobile
- Email list management (Klaviyo integration, consent flow)
- Multi-location awareness
- Audit log
- CSV export

### V2 — the workflow layer (adds 8–10 weeks)

- Dynamic rule-based segments
- Native membership management (credits ledger, tier changes, pause/cancel)
- Appointments two-way sync with booking system
- Custom frame design end-to-end workflow
- Phone app (lightweight counterpart to tablet)
- SMS outreach (Klaviyo SMS or Twilio)
- Email composition inside CRM (segment → Klaviyo send)
- Outbound webhooks (Zapier, analytics)
- Preference learning from purchase history (automatic tagging)

### V3 — the intelligence layer

- Next-best-action per client
- Frame rotation eligibility alerts
- Churn prediction on membership
- LTV forecasting
- Styling preference model (per-client recommendation engine)
- In-store client-facing iPad mode

---

## 4. Database architecture

This is the foundation. Everything else depends on it.

### 4.1 The problem

Three surfaces (storefront, CRM web, mobile apps) need fast reads of Shopify-owned data — customers, orders, products, tags, metafields. Shopify's Admin API has rate limits (40 requests/second on standard, 80 on Plus) and latency (150–400ms per call). Hitting Shopify directly on every page load is a non-starter at any real scale.

At the same time, some data cannot live in Shopify: interaction timelines, custom design drafts, appointments, audit logs, credits ledger entries.

### 4.2 The approach — cache-and-projection pattern

One Postgres instance (Neon, Canadian region). It contains two kinds of tables:

**Shopify projection tables** — a local mirror of Shopify data, kept in sync via webhooks. Never written to directly by any surface. The "read plane."

**CRM-owned tables** — data Shopify cannot model. Written to by the CRM API. The "write plane for CRM-native data."

All surfaces (web, tablet, phone, storefront) read from the same Postgres (via the CRM API, or direct reads where appropriate for the storefront). All writes to Shopify-owned data flow through the CRM API's Shopify write layer, which calls Admin API, receives the webhook back, and updates the projection. Writes to CRM-owned data flow straight into Postgres.

```
┌──────────────────┐
│     SHOPIFY      │◄──────── Admin API writes (from CRM write layer)
│  (source of      │
│   truth)         │────────► Webhooks (change events)
└──────────────────┘                   │
                                       ▼
                          ┌─────────────────────────┐
                          │   Webhook processor     │
                          │   (Inngest)             │
                          └───────────┬─────────────┘
                                      │
                                      ▼
     ┌────────────────────────────────────────────────────┐
     │                   POSTGRES                         │
     │                                                    │
     │  Shopify projection tables (mirror, read-only)    │
     │    customers_projection                            │
     │    orders_projection                               │
     │    products_projection                             │
     │    product_variants_projection                     │
     │    metafields_projection                           │
     │    customer_tags_projection                        │
     │                                                    │
     │  CRM-owned tables (authoritative for these rows)  │
     │    interactions                                    │
     │    second_sight_intakes                            │
     │    appointments                                    │
     │    custom_designs                                  │
     │    credits_ledger                                  │
     │    preferences_derived                             │
     │    audit_log                                       │
     │                                                    │
     └──────────▲─────────────────────────────────────────┘
                │
                │ reads (all surfaces)
                │
     ┌──────────┴──────────────┐
     │                         │
┌────▼─────┐   ┌───────┐   ┌───▼─────┐   ┌──────────┐
│Storefront│   │  CRM  │   │ Tablet  │   │  Phone   │
│ (Next.js)│   │ (web) │   │ (Expo)  │   │  (Expo)  │
└──────────┘   └───────┘   └─────────┘   └──────────┘
                               │              │
                               │ replicates   │ replicates
                               ▼              ▼
                           ┌────────┐    ┌────────┐
                           │SQLite  │    │SQLite  │
                           │(offline│    │(offline│
                           │ cache) │    │ cache) │
                           └────────┘    └────────┘
```

### 4.3 Why this shape

- **Single source of truth.** Shopify holds it. Projection tables are derived.
- **Fast reads.** All surfaces query Postgres, which returns in 10–30ms.
- **Rate limits don't hurt users.** Surfaces never call Shopify directly during a page render.
- **Drift is bounded.** Writes always flow app → CRM API → Shopify → webhook → projection. There's no path where a surface can write directly to the projection and skip Shopify.
- **Storefront gets the same data.** No divergence between what the customer sees on the storefront and what staff see in the CRM.
- **Mobile offline works.** SQLite replicates a subset (the current client context, today's appointments, recent intakes). Writes queue locally, push to CRM API on reconnect.

### 4.4 Projection table shape

Each projection table mirrors the Shopify shape with two added columns: `synced_at` (when the webhook was processed) and `shopify_updated_at` (Shopify's own updated_at timestamp, for drift detection).

Example: `customers_projection`

```
shopify_customer_id    string (PK)
email                  string
phone                  string
first_name             string
last_name              string
total_spent            decimal
order_count            integer
tags                   string[] (Shopify tags)
default_address        jsonb
addresses              jsonb (array)
metafields             jsonb (namespaced, all custom fields)
accepts_marketing      boolean
sms_consent            boolean
created_at             timestamp
shopify_updated_at     timestamp
synced_at              timestamp
```

Metafields are stored as a single JSONB column rather than a separate table. Shopify returns them nested. Keep the shape. Query via `metafields->'custom'->>'face_shape'` indexed with GIN.

### 4.5 Webhook reliability

Webhooks are not delivery-guaranteed. Three-layer defence:

1. **Idempotent handlers.** Upsert by shopify id + check shopify_updated_at. If incoming is older than stored, drop.
2. **Nightly reconciliation.** Cron at 3am EST pulls all Shopify objects updated in the last 48 hours. Compares to projection. Resolves drift. Logs discrepancies to `sync_events`.
3. **On-demand backfill.** Admin action on any entity: "Re-sync from Shopify." Manual fallback.

### 4.6 Redis cache layer

Upstash Redis sits in front of Postgres for two things:

- **Session and auth state** (Clerk-linked, see [Section 9](#9-shared-authentication-and-identity))
- **Hot query cache** for the storefront PLP and PDP — collection queries, product detail, cached 60 seconds with webhook-driven invalidation

CRM queries go straight to Postgres. The cache is for the storefront's concurrent load.

### 4.7 Mobile offline sync

Tablet and phone replicate a scoped subset to local SQLite via WatermelonDB:

- **Always cached:** last 30 viewed clients with full profile + timeline + orders
- **Location-scoped:** today's appointments, open Second Sight intakes, custom designs in draft/review
- **Product catalogue:** full (it's small, ~200 products — see [Section 8](#8-product-catalogue--shared-across-surfaces))

Writes while offline queue locally with a `pending_sync` flag. On reconnect, drain queue to CRM API in chronological order. Conflicts resolve newest-wins with audit entry.

### 4.8 Write ordering and consistency

When the CRM writes a tag to a customer:

1. CRM API receives the write
2. Writes to audit_log immediately (before Shopify call) with status `pending`
3. Calls Shopify Admin API (mutation: customerUpdate)
4. Receives Shopify response, updates audit_log status to `success` or `failed`
5. Shopify fires webhook back (`customers/update`)
6. Webhook processor updates `customers_projection`
7. Surfaces see the new tag on next query

Typical latency from CRM write to projection update: 300–800ms. During that window, optimistic UI on the write-initiating surface; other surfaces see the old value until their next fetch. Acceptable for this domain.

### 4.9 Storefront consumption

The storefront (React frontend already defined in the functionality spec) reads from the same Postgres projection, not directly from Shopify Storefront API for customer-owned data. Product catalogue browsing can still use Shopify Storefront API if desired (it's customer-facing and cached). Customer account pages read from projection for speed and to show loyalty data, preferences, and custom designs consistently with the CRM.

Checkout still uses Shopify's hosted checkout — that's non-negotiable and handles all PCI scope.

---

## 5. Data model — Shopify first

### 5.1 Contact data

| Requirement | Shopify primitive |
|---|---|
| Full name, primary email, primary phone | `customer.firstName`, `customer.lastName`, `customer.email`, `customer.phone` (native) |
| Additional emails / phones | Metafield `custom.secondary_emails` (list.single_line_text_field), `custom.secondary_phones` (list.single_line_text_field) |
| Addresses | `customer.addresses` (native, supports multiple) |
| Birthday | Metafield `custom.birthday` (date) |
| Anniversary | Metafield `custom.anniversary` (date) |
| Pronouns | Metafield `custom.pronouns` (single_line_text_field) |

### 5.2 Customer metadata

All metafields under namespace `custom`:

| Key | Type | Purpose |
|---|---|---|
| `face_shape` | single_line_text_field | Oval / Round / Square / Heart / Oblong |
| `frame_width_mm` | number_integer | Fit recommendation |
| `bridge_width_mm` | number_integer | Fit recommendation |
| `temple_length_mm` | number_integer | Fit recommendation |
| `rx_on_file` | boolean | Rx status |
| `rx_last_updated` | date | Reminder trigger |
| `rx_file` | file_reference | Latest prescription PDF |
| `internal_notes` | multi_line_text_field | Long-form SA notes |
| `do_not_contact` | boolean | Hard suppression |
| `home_location` | single_line_text_field | Home store handle |
| `preferences_json` | json | Structured preferences — see [Section 7](#7-preferences-model) |
| `marketing_consent_email` | boolean | Email marketing consent |
| `marketing_consent_sms` | boolean | SMS marketing consent |
| `marketing_consent_updated_at` | date | Consent audit |

### 5.3 Customer tagging

Shopify customer tags remain the primary classification system. Seeded taxonomy unchanged from v0.2.

### 5.4 Purchase and return history

Already in Shopify natively. Projection tables mirror:
- `customer.orders` → `orders_projection`
- `order.lineItems` → `line_items_projection`
- `order.returns` → `returns_projection`
- `order.refunds` → `refunds_projection`

Return rate per customer is computed on read.

### 5.5 Membership tier and credits

| Field | Shopify storage |
|---|---|
| Tier | Customer tag: `member-essential` / `member-cult` / `member-vault` |
| Membership status | Customer metafield `custom.membership_status` |
| Credit balance | Customer metafield `custom.credits_balance` (number_decimal, running total) |
| Member since | Customer metafield `custom.member_since` |
| Next renewal | Customer metafield `custom.next_renewal` |
| Last rotation used | Customer metafield `custom.last_rotation_used` |
| Last lens refresh | Customer metafield `custom.last_lens_refresh` |

Individual ledger transactions — CRM-owned (`credits_ledger` table).

---

## 6. CRM-owned data (thin layer)

Seven tables. Everything else is Shopify.

### 6.1 `interactions`
(Unchanged from v0.2.)

### 6.2 `second_sight_intakes`
(Unchanged from v0.2.)

### 6.3 `appointments`
(Unchanged from v0.2.)

### 6.4 `custom_designs`
(Unchanged from v0.2.)

### 6.5 `credits_ledger` (new)

```
id                 uuid
shopify_customer_id  string (indexed)
transaction_type   enum (issued_membership | issued_birthday | issued_manual | issued_second_sight | redeemed_order | expired | adjustment)
amount             decimal (positive for credit, negative for redemption)
running_balance    decimal (post-transaction balance, denormalized for speed)
reason             text (required for manual adjustments)
related_order_id   string (Shopify order id, when redemption)
related_intake_id  uuid (when Second Sight)
staff_id           string (who authorized, if manual)
location_id        string
occurred_at        timestamp
created_at         timestamp
```

Sum of `amount` for a customer = their true balance. Reconciled nightly against Shopify metafield `custom.credits_balance`, drift logged.

### 6.6 `preferences_derived` (new)

Computed preference signals updated by background jobs. See [Section 7](#7-preferences-model).

```
shopify_customer_id  string (PK)
derived_shapes     jsonb (array with frequency weights)
derived_materials  jsonb (array with frequency weights)
derived_colours    jsonb (array with frequency weights)
derived_price_range jsonb ({min, max, avg})
derived_lens_types jsonb (array)
last_computed_at   timestamp
source_order_count integer
```

### 6.7 `audit_log`
(Unchanged from v0.2.)

---

## 7. Preferences model

Preferences drive recommendations, outreach targeting, and the "known by the brand" feeling that matters at this tier. Three layers.

### 7.1 Stated preferences

What the client or SA has explicitly said they like. Lives in Shopify as metafields:

- `custom.preferences_json` (json) — structured object:

```json
{
  "shapes": ["round", "square"],
  "materials": ["acetate"],
  "colours": ["tortoise", "crystal"],
  "avoid": ["metal", "rimless"],
  "brands_admired": ["Jacques Marie Mage"],
  "notes": "Prefers lighter frames, finds acetate sometimes heavy"
}
```

Edited on the client profile (web or tablet) by SAs after a fitting, or by the customer on their storefront account page. Changes fire a webhook that refreshes the projection.

### 7.2 Derived preferences

Computed from purchase history. `preferences_derived` table, refreshed nightly and on order-fulfilled webhook.

Logic:
- Count shapes across all purchased products. Weight recent more.
- Same for materials, colours.
- Price range from actual purchases.
- Lens types from variant history.

Used for: recommendation queries, segmentation rules ("clients whose derived shape matches X"), and as a fallback when stated preferences are empty.

### 7.3 Implicit preferences (V2+)

Behavioural signals from storefront browsing — products viewed but not purchased, wishlist adds, comparison behaviour. Requires storefront event tracking (PostHog or Segment). V2.

### 7.4 Preferences UI

**On the client profile** — both stated and derived preferences shown side by side. Stated is editable. Derived is read-only with a tooltip showing the source (e.g., "Based on 4 purchases").

**On the storefront account page** — the customer sees and edits their stated preferences. Matches the CRM view. The transparency is the point: "We remember what you told us."

**In recommendations** — the PDP "You may also like" and segment builder both consume derived preferences by default, with stated preferences as a stronger override.

### 7.5 Preference sync flow

Stated preferences edited in the CRM → metafield update via Admin API → webhook → projection update → visible everywhere.

Customer edits preferences on storefront → Storefront API (customer-facing) metafield update → webhook → projection update.

Same endpoint under the hood, different UI.

---

## 8. Product catalogue — shared across surfaces

The storefront consumes the catalogue via Shopify Storefront API (customer-facing). The CRM and mobile apps consume it via the Postgres projection. Both are necessary.

### 8.1 Projection tables

```
products_projection
  shopify_product_id    string (PK)
  handle                string
  title                 string
  description           rich_text (HTML)
  product_type          string
  vendor                string
  tags                  string[]
  collections           string[] (handles)
  images                jsonb (ordered array of CDN URLs)
  metafields            jsonb
  price_min             decimal
  price_max             decimal
  created_at            timestamp
  shopify_updated_at    timestamp
  synced_at             timestamp

product_variants_projection
  shopify_variant_id    string (PK)
  shopify_product_id    string (FK)
  title                 string
  sku                   string
  price                 decimal
  compare_at_price      decimal
  inventory_quantity    integer
  selected_options      jsonb ({colour, lens_type, size})
  image_url             string
  available_for_sale    boolean
  metafields            jsonb

collections_projection
  shopify_collection_id string (PK)
  handle                string
  title                 string
  product_ids           string[]
```

### 8.2 Why project the catalogue

- **Speed.** A tablet in-store showing a product while an SA talks to a client needs to be instant. Storefront API at 200–400ms per call doesn't cut it during a fitting.
- **Offline.** The mobile apps need the catalogue offline. Whole catalogue is ~200 products, a few MB. Replicates cleanly to SQLite.
- **Consistent queries.** The CRM and mobile apps query with SQL — filter by tag, by face-shape compatibility, by price range — without inventing a second query language against Shopify GraphQL.
- **Recommendation engine feeds.** The preference-matching logic queries the projection, joined against `preferences_derived`.

### 8.3 Product browser — CRM and mobile

`/products` in the CRM and a `Products` tab in the tablet app. Same underlying data. Staff can:

- Browse the full catalogue with filters (matches storefront PLP filters: shape, colour, material, size, lens options)
- View a product detail with all variants, prices, inventory at each location
- Add a product to a client's wishlist (V2)
- Recommend a product to a client in session (creates a draft cart link the SA can text to the client, or adds to a pending order)
- See historical sales data per product (owner + manager only)

### 8.4 Inventory visibility

Per-location inventory is mirrored from Shopify `inventoryLevel` into the projection. SAs see live stock at their location, plus a note of availability at other locations ("2 at Plateau, 1 at DIX30"). Critical for in-store recommendations when a preferred colour isn't in hand.

### 8.5 Catalogue access on storefront

Storefront (already in functionality spec) continues to use Shopify Storefront API for customer-facing PDP and PLP. Caches layered (Vercel edge + Redis). No reason to proxy through Postgres for the storefront — Storefront API is built for exactly this load and has its own CDN.

So: storefront reads from Shopify Storefront API, CRM and mobile read from Postgres projection. Same underlying catalogue, different access path, both current.

---

## 9. Shared authentication and identity

Three user types (customer, staff, system), three surfaces (storefront, CRM, mobile), one identity model.

### 9.1 The identity layers

Two identity providers, linked:

**Clerk** — staff identity. Owner, store managers, SAs. Handles:
- Email + password, or Google SSO
- Multi-factor auth (mandatory for owner and manager roles)
- Device management
- Session tokens for web and mobile
- Role and location assignment

**Shopify Customer Accounts** — customer identity. Handles:
- Customer-facing login on the storefront
- Account page (orders, preferences, membership, Rx)
- Checkout continuity
- Native to Shopify, no custom work

Both providers are used simultaneously. Staff never log in as customers. Customers never log in as staff. A person who is both (e.g., Benjamin shops on his own store) has two accounts. That's fine.

### 9.2 Staff session across surfaces

A staff member logs in once, gets a Clerk session. That session is valid across:

- CRM web app (primary)
- Tablet app (via Clerk's React Native SDK)
- Phone app (same)

Shared session means an SA who logs into the tablet in the morning doesn't need to re-auth on the phone. The CRM API accepts the same token from any surface and resolves the role + location + surface into the audit log.

Session expiry: 14 days idle on mobile (with biometric unlock), 7 days on web. Refresh tokens rotate silently.

### 9.3 Customer session across surfaces

Customer logs in on the storefront via Shopify Customer Accounts. Session is cookie-based on `lunettiq.com` (or whatever the final domain is). The storefront reads this session to personalize.

Customer account data (orders, preferences, membership, loyalty credits) is visible on the storefront account page, powered by reads from the Postgres projection. Not all of this is exposed via Shopify's native account page, so the storefront builds its own account UI consuming the projection via authenticated API routes.

### 9.4 Staff viewing as customer

SAs occasionally need to see what a customer sees — helping a client through checkout, understanding a display issue. V2 feature: "View as customer" in the CRM profile creates a time-limited impersonation token that opens the storefront as the customer, with a visible banner. All actions during impersonation are audited as the staff member, not the customer.

### 9.5 Magic-link storefront login (V2)

For customers who forget passwords or want seamless re-engagement from email/SMS campaigns, Klaviyo-generated magic links authenticate the customer into Shopify Customer Accounts. Standard Shopify feature. Works naturally with email flows.

### 9.6 Permissions model

Clerk roles map to CRM permissions (see [Section 21](#21-permissions-and-audit)). Location membership is a separate dimension — a manager can be assigned to one or more locations. SA can be assigned to one location (V1) or multiple (V2).

Every API request from a staff surface carries: `{ clerk_user_id, role, location_ids, surface }`. The CRM API enforces permissions server-side. No permission logic in the client.

---

## 10. Email and SMS list management

Lunettiq needs marketing channels that respect luxury pacing — sparse, beautiful, relevant. Not drip funnels. This section covers how the CRM interacts with that stack.

### 10.1 The tool — Klaviyo

Klaviyo handles:
- Email sending (transactional + marketing)
- SMS sending (V2)
- Subscriber list management with double opt-in where required by law
- Consent tracking per channel
- Flow builder for lifecycle campaigns
- A/B testing and performance analytics

The CRM does not send emails or SMS directly. Klaviyo is the system of record for messaging state. The CRM drives segmentation and syncs it to Klaviyo.

### 10.2 Consent as source of truth

Shopify holds the authoritative consent state:
- `customer.emailMarketingConsent` — email consent (native Shopify field)
- `custom.marketing_consent_sms` — SMS consent (metafield, since Shopify's native SMS consent field is thin)
- `custom.marketing_consent_updated_at` — audit
- `custom.do_not_contact` — hard override

Any channel of contact must check the appropriate consent before sending. The CRM surfaces consent state prominently on the client profile. Staff can toggle consent manually when a client makes a verbal request ("take me off the list") — recorded with staff ID and timestamp in the audit log.

### 10.3 Consent capture points

| Point | Email consent | SMS consent |
|---|---|---|
| Storefront footer signup | ✅ (default opt-in with explicit checkbox) | ❌ |
| Checkout marketing opt-in | ✅ (default unchecked, Shopify native) | ✅ (checkbox) |
| Account creation | ✅ (explicit opt-in) | ✅ (explicit opt-in) |
| In-store (tablet) during intake | ✅ (staff asks, records in CRM) | ✅ (same) |

Quebec's Law 25 and Canadian CASL both require explicit, provable consent. Every consent event logs to `audit_log` with source, timestamp, and staff_id or IP.

### 10.4 List segmentation — CRM → Klaviyo

Segments defined in the CRM (see [Section 13](#13-segmentation-engine)) sync to Klaviyo as lists:

- Named segments push to Klaviyo on save ("CULT members due for lens refresh" → Klaviyo list of same name)
- Membership changes based on rule re-evaluation (hourly) push delta updates to Klaviyo
- Unsubscribes in Klaviyo flow back to Shopify consent fields via webhook, keeping the source of truth aligned

Klaviyo's native Shopify integration handles most of this. Custom work is minimal: a Klaviyo app installed on the Shopify store, plus an API-based segment sync from the CRM for segments that can't be expressed in Klaviyo's own rules (interaction-based, custom metafield combinations).

### 10.5 Campaign composition

Campaign emails are composed in Klaviyo. The CRM doesn't try to be an email composer. What the CRM does provide:

- Segment creation with live preview
- "Send campaign to this segment" button — opens Klaviyo campaign editor pre-populated with the segment as recipient list
- Reporting pull-back: campaign send results (sent, opens, clicks) attached to each client's interaction timeline

### 10.6 Transactional vs marketing

| Message type | Channel | System |
|---|---|---|
| Order confirmation, shipping, delivery | Email | Shopify (native) |
| Appointment reminders | Email + SMS | Klaviyo (triggered from CRM webhook) |
| Second Sight intake confirmation | Email | Klaviyo |
| Custom design approval notification | Email | Klaviyo |
| Marketing newsletters | Email | Klaviyo (segment-driven) |
| Campaign SMS | SMS | Klaviyo SMS (V2) |
| In-store SA-initiated outreach | Email or SMS | Klaviyo (triggered from CRM) |

### 10.7 SMS specifics

SMS in Canada is heavily regulated (CASL, CRTC). Rules the system enforces:

- No marketing SMS without explicit opt-in captured with timestamp and source
- STOP / UNSUBSCRIBE keyword handling built into Klaviyo (mandatory)
- Identification of sender in every message (brand name)
- No SMS between 9pm and 9am local time (auto-enforced in Klaviyo send window)
- Character count awareness (SMS messages over 160 chars split and cost more)

### 10.8 Messaging in the client profile

Every email and SMS sent appears in the interaction timeline automatically:

- Type: `email` or `sms`
- Direction: `outbound`
- Body: subject + preview text for email; full message for SMS
- Metadata: campaign name, opened / clicked status (email), delivered / failed status (SMS)

Reply handling (when a customer replies to a transactional email or SMS) for V2 — routes replies into the CRM as inbound interactions. V1 just logs outbound.

### 10.9 Staff-initiated one-off messages

An SA after a fitting wants to text the client a photo of a frame being held. V2 feature:

- From client profile → "Send message" → compose screen
- Choose channel (email / SMS, based on consent)
- Compose in a branded template
- Send via Klaviyo API
- Logged to timeline

V1: the SA uses their personal phone to text or email the client and manually logs the interaction. Not elegant but ships faster.

---

## 11. Information architecture — web

### 11.1 Route map

| Route | Role access | Purpose |
|---|---|---|
| `/` | Owner, Manager | Dashboard — role-aware |
| `/dashboard/cross-location` | Owner | Roll-up of all locations |
| `/location/[locationId]` | Manager, Owner | Single location overview |
| `/clients` | All | Client list with filter bar |
| `/clients/[id]` | All | Client profile |
| `/clients/new` | All | Create new client |
| `/products` | All | Product catalogue browser |
| `/products/[id]` | All | Product detail (with inventory across locations, sales history) |
| `/segments` | All | Saved segments |
| `/segments/[id]` | All | Segment detail + member list |
| `/segments/new` | Manager, Owner | Rule builder |
| `/second-sight` | All | Intake queue and history |
| `/second-sight/[id]` | All | Intake detail |
| `/custom-designs` | All | Design queue |
| `/custom-designs/[id]` | All | Design detail and revision history |
| `/appointments` | All | Calendar view |
| `/membership` | Manager, Owner | Membership dashboard |
| `/membership/[clientId]` | All | Individual membership management (V2) |
| `/campaigns` | Manager, Owner | Campaign list, pulled from Klaviyo |
| `/campaigns/[id]` | Manager, Owner | Campaign detail and performance |
| `/reports` | Manager, Owner | Pre-built reports + custom exports |
| `/settings/tags` | Manager, Owner | Tag taxonomy management |
| `/settings/locations` | Owner | Location management |
| `/settings/staff` | Owner | Staff accounts and role assignment |
| `/settings/integrations` | Owner | Shopify app, Klaviyo, booking system |
| `/settings/audit` | Manager, Owner | Audit log |
| `/settings/consent` | Owner | Consent policy and audit |

### 11.2 Navigation

Left sidebar, collapsible:

```
[Logo]

  Clients           ◆
  Products
  Segments
  Second Sight
  Custom Designs
  Appointments
  ─────────
  Membership       (manager+)
  Campaigns        (manager+)
  Reports          (manager+)
  ─────────
  Settings         (manager+)

  [Location switcher]
```

Global search `⌘K` searches clients, orders, products, designs, appointments.

---

## 12. Client profile — web

### 12.1 Layout

Three-column layout on desktop.

**Left column — identity (sticky)**
- Avatar, name, pronouns
- Tier badge with credits balance
- Primary email + phone (with consent indicators — green dot if opted in, grey if not)
- Primary address
- Birthday + anniversary
- Quick stats: LTV, order count, return rate, member since, home location
- Tags
- Consent row: 📧 Email ✓ / 💬 SMS ✓ / 🔇 DNC (toggles, audited)

**Centre column — activity (scrollable)**
- Interaction timeline with filter chips

**Right column — context panels (collapsible)**
- Fit profile
- **Preferences** — stated + derived, visually distinct (see [Section 7](#7-preferences-model))
- Recent orders (last 3)
- Second Sight history
- Custom design drafts
- Internal notes

### 12.2 Primary actions (header)

- Add interaction
- Book appointment
- Start Second Sight intake
- Start custom design
- Send message (V2 — email or SMS via Klaviyo)
- Recommend product (opens product picker, adds recommendation to timeline + optional SMS with link to PDP)
- Adjust credits (V2)
- More: export profile, merge duplicate, archive

### 12.3 Editing

Every field editable inline. Shopify-mirrored fields show a small Shopify glyph but edit the same way — the CRM writes back via Admin API. Consent toggles require a confirmation modal (regulatory weight).

### 12.4 Duplicate handling
(Unchanged from v0.2.)

---

## 13. Segmentation engine

### 13.1 Approach

Segments evaluated against the Postgres projection (fast, no Shopify API calls at query time).

**Available attributes:**

| Category | Attributes |
|---|---|
| Identity | Name, pronouns, birthday month, city, country, home location |
| Commercial | LTV, order count, first/last order date, AOV, return rate |
| Recency/Frequency | Days since last order, orders in last N days |
| Membership | Tier, status, credits balance, days until renewal, last rotation used |
| Product | Owns product, owns from collection, has bought shape X, has bought material Y |
| Preferences | Stated shape includes, derived shape matches, stated material, derived price range |
| Behavioural | Tag includes/excludes, do_not_contact, last interaction type |
| Fit | Face shape, frame width range, Rx on file |
| Consent | Email consent = true/false, SMS consent = true/false |
| Custom | Any custom metafield |

Operators: equals, not equals, contains, does not contain, greater than, less than, between, is empty, is not empty, in last N days.

### 13.2 Rule builder

AND/OR combinations, nested up to two levels. Live preview of member count as rules change.

### 13.3 Actions from a segment

- Export CSV
- Bulk add/remove Shopify tag (writes back, audited, queued through rate-limit handler)
- Sync to Klaviyo as a list (V1)
- Send campaign via Klaviyo (V2, opens Klaviyo with segment pre-populated)
- Bulk add interaction (V2)

---

## 14. Interaction timeline

(Unchanged structure from v0.2. Adds: email/SMS entries from Klaviyo sync, campaign send entries, product recommendation entries.)

New entry types:

| Type | Source |
|---|---|
| Email sent | Klaviyo webhook (outbound) |
| Email opened | Klaviyo webhook |
| Email clicked | Klaviyo webhook |
| SMS sent | Klaviyo webhook (outbound) |
| Campaign sent | Klaviyo webhook (batch of clients) |
| Product recommended | CRM action (SA recommends a product in session) |
| Preferences updated | CRM or storefront action |

---

## 15. Second Sight module

(Unchanged from v0.2.)

---

## 16. Membership module

### 16.1 V1 (display + light controls)
(Unchanged from v0.2.)

### 16.2 V2 (native credits ledger)

Credits ledger (`credits_ledger`) is the authoritative transaction log. Running balance denormalized for speed, reconciled nightly against Shopify metafield.

Every credit event:
- `issued_membership` — monthly deposit, automated
- `issued_birthday` — annual
- `issued_manual` — staff adjustment with reason
- `issued_second_sight` — from intake
- `redeemed_order` — at checkout, from Shopify order webhook
- `expired` — on cancellation 60-day window
- `adjustment` — reconciliation correction

### 16.3 Membership dashboard
(Unchanged from v0.2.)

---

## 17. Appointments module

(Unchanged from v0.2. Added: appointment reminders triggered via Klaviyo — reference Section 10.6.)

---

## 18. Custom frame design module

(Unchanged from v0.2.)

---

## 19. Mobile app — SA tablet and phone

### 19.1 Tablet
(Unchanged from v0.2.)

**Added: product browser tab.** SA can browse the catalogue from the tablet, see variants, inventory per location, and recommend to a client during a fitting. Recommendation creates a timeline entry + optional SMS with PDP link (V2).

### 19.2 Phone
(Unchanged from v0.2.)

### 19.3 Offline tolerance
(Updated from v0.2 — product catalogue is now part of the offline cache. See [Section 4.7](#47-mobile-offline-sync).)

### 19.4 Auth on mobile
Clerk native SDK. Biometric unlock after initial login. 14-day idle timeout.

---

## 20. Multi-location model

(Unchanged from v0.2.)

---

## 21. Permissions and audit

### 21.1 Role matrix

Additions for new modules:

| Action | Owner | Manager | SA | Read-only |
|---|---|---|---|---|
| View product catalogue | ✅ | ✅ | ✅ | ✅ |
| View product sales history | ✅ | ✅ | ❌ | ❌ |
| Recommend product to client | ✅ | ✅ | ✅ | ❌ |
| View consent state | ✅ | ✅ | ✅ | ✅ |
| Toggle consent on client profile | ✅ | ✅ | ✅ | ❌ |
| View campaigns | ✅ | ✅ | ✅ | ✅ |
| Create campaign in Klaviyo | ✅ | ✅ | ❌ | ❌ |
| View preferences (stated + derived) | ✅ | ✅ | ✅ | ✅ |
| Edit stated preferences | ✅ | ✅ | ✅ | ❌ |

All previous permissions from v0.2 unchanged.

### 21.2 Audit log
(Unchanged from v0.2. All consent toggles and preference edits logged with full diff.)

### 21.3 Data protection
(Unchanged from v0.2.)

---

## 22. Reporting and exports

Additions:

- **Consent report** — opted-in counts by channel, opt-out rate trailing 90 days
- **Campaign performance rollup** — pulled from Klaviyo, aggregated per segment
- **Product recommendation-to-purchase rate** — how often in-session recommendations convert
- **Preferences coverage** — % of clients with stated preferences filled

(All previous reports from v0.2 unchanged.)

---

## 23. Tech architecture

### 23.1 Stack (updated)

| Layer | Choice | Why |
|---|---|---|
| Web frontend | Next.js 14 App Router | Shared with storefront |
| Mobile | Expo (React Native) + WatermelonDB | Tablet + phone from one codebase, offline-capable |
| Primary database | Postgres (Neon, CA region) | Projections + CRM-owned tables |
| Cache | Upstash Redis | Storefront hot queries, session state |
| ORM | Drizzle | Type-safe |
| Staff auth | Clerk | SSO, multi-role, biometric mobile |
| Customer auth | Shopify Customer Accounts | Native storefront |
| Background jobs | Inngest | Webhooks, reconciliation, sync queue, Klaviyo sync |
| File storage | Cloudflare R2 | Photos, prescriptions, design refs |
| Messaging | Klaviyo | Email + SMS, consent, flows |
| Analytics events | PostHog (V2) | Storefront behaviour for implicit preferences |
| Deployment | Vercel (web) + Expo EAS (mobile) | |
| Observability | Sentry + Axiom | |

### 23.2 API surface

Three logical APIs, all in the same Next.js app:

1. **`/api/shopify/*`** — Shopify write layer (internal, called by CRM API)
2. **`/api/crm/*`** — CRM operations (called by web + mobile)
3. **`/api/storefront/*`** — Customer-facing (called by storefront), authenticated with Shopify Customer Accounts session

### 23.3 Webhook handling

Inbound from Shopify:
- `customers/create|update|delete`
- `orders/create|updated|cancelled|fulfilled`
- `refunds/create`
- `returns/request|approve`
- `products/create|update|delete`
- `inventory_levels/update`
- `collections/create|update`

Inbound from Klaviyo:
- `email_sent`, `email_opened`, `email_clicked`
- `sms_sent`, `sms_delivered`
- `subscribed`, `unsubscribed` (syncs back to Shopify consent)

All webhooks validated with HMAC, processed idempotently, queued via Inngest with retries.

### 23.4 Rate limits

Shopify Admin API bottleneck is the main constraint. Mitigations:

- All writes routed through a single queue (Inngest) that respects rate budget
- Bulk writes (tag 500 customers) chunked and paced
- Read cache (projection) eliminates most read pressure
- Shopify Plus by V2 — 2x rate budget, plus Functions and Shopify Flow

### 23.5 Performance budgets

(Unchanged from v0.2, plus:)

| Surface | p95 target |
|---|---|
| Storefront account page load | < 600ms |
| Storefront product detail | < 400ms |
| Tablet product browser | < 300ms (cached) |

### 23.6 Updated data flow diagram

```
          ┌────────────────────────────────────────────┐
          │              SHOPIFY                       │
          │   customers · orders · products · tags     │
          │   metafields · draft orders · returns      │
          │   (source of truth)                        │
          └────────┬───────────────────────────────▲───┘
                   │ webhooks                      │ Admin API
                   ▼                               │
          ┌────────────────────────────────────────┴───┐
          │         CRM API (Next.js)                  │
          │                                            │
          │   ┌───────────────┐  ┌──────────────────┐  │
          │   │ Shopify write │  │ Projection cache │  │
          │   │ layer + audit │  │ (Postgres)       │  │
          │   └───────────────┘  │                  │  │
          │                      │ CRM-owned tables │  │
          │                      └──────────────────┘  │
          │   ┌────────────────────────────────────┐   │
          │   │ Klaviyo sync (segments, consent)   │   │
          │   └────────────────────────────────────┘   │
          └──▲────────▲──────────────▲────────▲────────┘
             │        │              │        │
      ┌──────┘   ┌────┘              │        └──────┐
      │          │                   │               │
 ┌────▼─────┐ ┌──▼────┐        ┌────▼────┐    ┌─────▼────┐
 │Storefront│ │  CRM  │        │ Tablet  │    │  Phone   │
 │ (Next.js)│ │ (web) │        │ (Expo)  │    │  (Expo)  │
 └─────┬────┘ └───────┘        └────┬────┘    └────┬─────┘
       │                            │              │
       │ Shopify                    │ SQLite       │ SQLite
       │ Customer                   │ (offline)    │ (offline)
       │ Accounts                   │              │
       ▼                            ▼              ▼
 ┌──────────┐              ┌──────────────────────────┐
 │ Shopify  │              │ Clerk (staff auth)       │
 │ hosted   │              │ biometric, SSO           │
 │ checkout │              └──────────────────────────┘
 └──────────┘

 ┌─────────────────────────┐
 │       Klaviyo           │ ◄── webhooks out ── CRM API
 │  email + SMS sending    │ ─── webhooks in ───► CRM API
 │  consent records        │
 └─────────────────────────┘
```

---

## 24. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **Database provider** | A: Neon (serverless, cheap). B: Supabase (richer, more opinionated). C: Self-managed RDS. | A — serverless fits variable traffic, Canadian region available, pairs with Vercel cleanly. |
| 2 | **Loyalty provider** | A: Native. B: Yotpo. C: Smile.io. | A, for UI control. |
| 3 | **Subscription billing** | A: Shopify Subscriptions. B: Recharge. C: Bold. | A if feasible. B for advanced pause/upgrade. |
| 4 | **Second Sight credit mechanism** | A: Metafield increment. B: Draft order with $0 total. | B — auditable. |
| 5 | **Appointments booking system** | A: Square. B: Calendly. C: Custom. | B for V1. |
| 6 | **Custom design payment flow** | A: Upfront. B: 50% deposit / 50% completion. C: Configurable. | B. |
| 7 | **Offline conflict resolution** | A: Newest-wins. B: Flag and resolve. | A for V1. |
| 8 | **Client photo storage** | A: R2, CA region. B: Shopify Files. | A. |
| 9 | **Tablet hardware** | A: iPad. B: Android. C: Agnostic. | A. |
| 10 | **Shopify Plus by when** | V2 at latest | Yes. |
| 11 | **Messaging platform** | A: Klaviyo (recommended here). B: Customer.io. C: Mailchimp + Twilio. | A — native Shopify integration, SMS included, strong luxury brand usage. |
| 12 | **Product catalogue storefront reads** | A: Storefront API direct. B: Projection via CRM API. | A for storefront PDP/PLP (edge-cached), B for CRM and mobile. Both. |
| 13 | **Storefront account page** | A: Shopify native. B: Custom, reading from projection. | B — native doesn't show loyalty credits, preferences, custom designs. |
| 14 | **Customer auth** | A: Shopify Customer Accounts native. B: Custom on top of Clerk. | A — native, no PCI or password handling risk. |
| 15 | **Preferences — customer editability** | A: CRM-only (staff edits). B: Customer can also edit on storefront account. | B — transparency is brand-aligned. |
| 16 | **SMS provider if not Klaviyo** | Twilio + custom | Only if choosing non-Klaviyo stack. |
| 17 | **Consent audit retention** | A: 3 years. B: 7 years. | B — Law 25 ambiguity on marketing consent retention argues for longer. |

---

*Cross-reference: Functionality spec `lunettiq-functionality-spec.md` · Brand guidelines `lunettiq-brand-guidelines.md` · Loyalty program `lunettiq-loyalty-program.md` · Competitor analysis `lunettiq-competitor-analysis.md`*
