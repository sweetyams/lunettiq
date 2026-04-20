# Lunettiq — Next Improvements Specification

**Status:** Draft for review
**Last updated:** April 2026
**Cross-references:** `lunettiq-functionality-spec.md` · `lunettiq-crm-spec.md` · `lunettiq-loyalty-program-v2.md` · `lunettiq-personalization-strategy.md` · `01-appointments.md` · `05-product-recs.md`

---

## Framing

This document captures the next wave of features after the V1 site, CRM, and loyalty program ship. Each feature earns its place by either reinforcing the brand position (cultural signal + optical credibility + loyalty) or removing an operational cost that compounds at scale.

Nothing here duplicates existing specs. Everything here extends them.

**Design principles (applied throughout):**
- Brand-grade UX over DTC-standard UX — every feature should feel considered, not optimized.
- Operational features pay for the brand features. Build both in parallel, not in sequence.
- No feature ships without deciding how it appears in the CRM timeline.
- Omnichannel means the online and in-store experiences are the same customer, not two.

---

## Contents

1. [Journal — editorial content](#1-journal--editorial-content)
2. [Inventory hold on appointment booking](#2-inventory-hold-on-appointment-booking)
3. [Return / exchange self-service](#3-return--exchange-self-service)
4. [Customer service macros](#4-customer-service-macros)
5. [In-store client-facing iPad mode](#5-in-store-client-facing-ipad-mode)
6. [Wishlist with in-store integration](#6-wishlist-with-in-store-integration)
7. [Sequencing and dependencies](#7-sequencing-and-dependencies)
8. [Open decisions](#8-open-decisions)

---

## 1. Journal — editorial content

### 1.1 What it is

A real editorial publication, not a blog. Long-form articles, interviews with craftspeople, essays on eyewear history and optical culture, customer profiles, pieces on collaborators. Lives at `/journal` with individual articles at `/journal/[handle]`.

Already listed in the functionality spec V2 roadmap as a placeholder. This section makes it a feature commitment with scope, cadence, and integration requirements.

### 1.2 Why it matters

Jimmy Fairly and CHIMI both run editorial. For the positioning Lunettiq has defined (cultural signal + optical credibility), a real journal is not optional. It's the vehicle for the "access over discount" ethos — giving members and prospects something to read, not something to buy.

The journal also solves a practical problem: SEO for branded search and long-tail eyewear queries. Without editorial content, the site ranks only on frame product pages, which limits discovery to people who already know the brand.

### 1.3 Content pillars

Four editorial lanes. Each has its own cadence and tone.

**The Craft** — pieces on acetate sourcing, hinge construction, Italian manufacturing, lens technology. Technical but accessible. Byline from Lunettiq opticians or visiting experts.

**The Eye** — cultural pieces on eyewear in film, fashion, art, literature. The register of an editorial magazine, not a brand blog. This is where the "cultural signal" lives.

**The Face** — customer profiles. Three to six per year. Photographed subjects talking about their glasses, their work, their taste. Jimmy Fairly does a lighter version of this.

**The House** — brand-owned stories: new collection notes, collaborator interviews, archive reissues, event recaps.

### 1.4 Cadence

Two articles per month across the four lanes, rotated. Four articles live on the homepage of the journal at any time. Older articles archived but permanently accessible.

Quality over volume. Two good pieces a month beats eight forgettable ones.

### 1.5 Structure and IA

**Route map additions (to functionality spec §3.1):**

| Route | Purpose |
|---|---|
| `/journal` | Journal index — latest 12 articles, filter by pillar |
| `/journal/[handle]` | Individual article |
| `/journal/pillar/[slug]` | Filtered view by pillar (`/journal/pillar/the-craft`) |

**Article structure:**
- Hero image (full-bleed, 16:9 or 4:5)
- Title + pillar tag + publish date + read time
- Author byline with photo and one-line bio
- Body content (mixed media — text, full-bleed images, pull quotes, inline product cards)
- Related articles (3)
- "Frames featured in this article" card strip (if applicable)
- Footer CTA: newsletter signup or related collection

### 1.6 Shopify / CMS integration

**Content model.** Shopify blog native entity + metafields. Namespace `journal`:

| Field | Type | Purpose |
|---|---|---|
| `journal.pillar` | single_line_text_field | One of: `craft`, `eye`, `face`, `house` |
| `journal.author_name` | single_line_text_field | Byline |
| `journal.author_bio` | multi_line_text_field | One-line bio |
| `journal.author_image` | file_reference | Byline photo |
| `journal.read_time_minutes` | number_integer | Calculated or manual |
| `journal.featured_products` | list.product_reference | Products linked inline and at footer |
| `journal.hero_image` | file_reference | Full-bleed hero |
| `journal.excerpt` | multi_line_text_field | 2-3 sentence index teaser |

**Rich body content** handled via Shopify's native rich text editor. For the first year, avoid a headless CMS (Sanity, Contentful) — Shopify blog gets you 80% there at 20% the complexity.

### 1.7 CRM integration

Journal article views are tracked per customer and feed derived preferences:

- Track: which articles a customer reads (requires PostHog, V2 scope in CRM spec §23.1)
- Signal type: content affinity — which pillars resonate
- Use: drive content recommendations on future journal visits, inform product recommendations ("readers of The Craft articles tend to buy acetate frames at a higher rate")

Article interactions are logged as timeline entries (CRM spec §14):

| Type | Source |
|---|---|
| Article viewed | PostHog event |
| Article shared | Storefront action |
| Newsletter signup from article | Klaviyo webhook |

### 1.8 Operational requirements

**Editorial ownership.** A named content lead — either in-house or retained. Without one, the journal dies in month 3 like 90% of brand blogs. Options:

1. Retained editor (1-2 days/week) at ~$2,500/month
2. Full-time brand content lead (justified at 500+ members or 3+ store locations)
3. Freelance editor + rotating contributors

**Production pipeline.** Editorial calendar planned quarterly. Individual articles briefed 4 weeks ahead. Photography scheduled 3 weeks ahead. Review cycle: editor → Benjamin → publish.

**Budget.** Assume $800-1,500 per article for external contributors (writer + photographer). In-house pieces cheaper.

### 1.9 Priority

Medium. V2.0 if a content lead is in place. V2.1 if content ownership is still being staffed.

---

## 2. Inventory hold on appointment booking

### 2.1 What it is

When a customer books an appointment (stylist consultation, eye exam, fitting) and specifies a frame of interest, the system places a soft hold on one unit of that frame at the appointment's location. Hold duration: 24 hours before the appointment through 2 hours after.

Hold is automatically released if:
- Customer doesn't attend (status: `no_show`)
- Customer attends but doesn't purchase
- 2 hours pass after the scheduled appointment end time
- Customer manually cancels

### 2.2 Why it matters

Stops the "I came in specifically for that frame and it's out of stock" failure mode. Currently that's solved by staff phoning ahead to confirm availability. Systematizing the hold removes friction for both sides.

At the luxury register, this is also a trust signal — "we saved it for you." Warby Parker and the DTC players don't do this because they don't have real store inventory. Lunettiq's physical retail presence makes this a differentiator.

### 2.3 How it works

**Booking flow addition.** On the appointments booking page (customer-facing), after selecting appointment type and time, an optional field appears: "Is there a specific frame you'd like us to have ready?"

- Typeahead search over products_projection
- Customer can select up to 3 frames
- On submit, soft holds are placed on each

**Staff-side creation.** When staff book an appointment on behalf of a customer via the CRM (appointments module, spec 01), the same frame-selection field appears in the create panel.

**Hold mechanism.** A new CRM-owned table:

```
inventory_holds
  id                    uuid
  shopify_variant_id    string (indexed)
  location_id           string (indexed)
  customer_id           string
  appointment_id        uuid (FK to appointments)
  quantity              integer (default 1)
  status                enum (active | released | consumed)
  held_from             timestamp
  hold_expires_at       timestamp
  released_at           timestamp (nullable)
  released_reason       text (nullable)
  created_at            timestamp
```

**Inventory display logic.** On the PDP and PLP, available inventory per location is calculated as:

```
displayed_available = shopify_inventory - sum(active_holds_for_that_variant_and_location)
```

If `displayed_available < 1` but `shopify_inventory >= 1`, show "Reserved for an appointment — available [time]" instead of "Out of stock."

### 2.4 Edge cases

- **Hold conflicts with walk-in purchase.** Staff override at POS with reason code. Logged in audit trail.
- **Customer reschedules.** Hold follows the new appointment time, stays active.
- **Multi-location holds.** Customer can't hold the same variant at two locations simultaneously. UI prevents it.
- **VAULT members.** Extended hold window (48 hours before, 4 hours after).

### 2.5 CRM integration

- Appointment detail view shows held frames as a "Held for this appointment" panel
- Client profile timeline logs: frame held, frame released (with reason), frame converted to purchase
- Staff dashboard shows active holds at their location (for prep)

### 2.6 Priority

High if physical retail is core to the business model. Medium if online-first. Matches appointments module V2 release.

---

## 3. Return / exchange self-service

### 3.1 What it is

Customer logs into their account, selects an order item, chooses a return reason from a defined list, receives a shipping label, and gets automatic credit or refund on warehouse receipt. No email back-and-forth required.

### 3.2 Why it matters

Eyewear has high return rates (15-25% industry-wide). Every return handled manually costs roughly 15 minutes of staff time. At 100 orders/day with a 15% return rate, that's 4 hours of daily ops cost that self-service eliminates.

The fear is that self-service feels cold. The counter: premium brands like Mr Porter and Ssense have excellent self-service returns, and customers prefer the control. The warm touch is in the follow-up *after* a return ("We noticed you returned the Draper — what didn't work?"), not in making the return itself friction-laden.

### 3.3 Eligibility rules

- Return window: 30 days from delivery (industry standard, matches Warby Parker)
- Non-prescription frames: full return
- Prescription frames: 50% refund by default (cost of custom lenses), full credit if exchanging
- Sale items: credit only, no refund
- Custom designs: non-returnable (communicated clearly at point of order)
- Frames showing damage: not eligible for self-service; routed to human review

### 3.4 Flow

**Step 1. Order selection.**
- Customer opens account → Orders
- Selects order → clicks "Return or exchange"
- Selects item(s) to return

**Step 2. Reason selection.**
Structured list, not free text. Tells you what's actually happening in the business:

| Reason | Follow-up question |
|---|---|
| Doesn't fit well | Which way? Too tight / too loose / too heavy / slides down |
| Doesn't suit my face | — |
| Colour looks different in person | — |
| Changed my mind | — |
| Received damaged | Photo upload required, routed to human review |
| Received wrong item | Routed to human review |
| Rx issue | Routed to optician review |
| Other | Free text, routed to human review |

**Step 3. Resolution selection.**
- Refund to original payment method (non-Rx only, minus lens cost if Rx)
- Store credit (always available, often preferred — adds 10% bonus)
- Exchange for different size / colour / frame

**Step 4. Shipping.**
- Prepaid label generated (Canada Post, default)
- Free return shipping for members, $8 for non-members
- Drop-off at any post office OR pickup from home (+$5, V2.1)

**Step 5. Receipt and resolution.**
- Warehouse scans returned item → status updates
- Condition check → refund / credit issued automatically if standard condition
- Exchange ships within 48 hours

### 3.5 Data model

CRM-owned table:

```
returns
  id                      uuid
  order_id                string (Shopify order id)
  customer_id             string
  line_items              jsonb (array of returned items + reasons)
  resolution_type         enum (refund | credit | exchange)
  resolution_amount       decimal
  status                  enum (requested | label_sent | in_transit | received | resolved | rejected)
  return_reason_primary   enum (see §3.4 table)
  return_reason_detail    text
  exchange_order_id       string (nullable, new order if exchange)
  shipping_label_url      text
  requested_at            timestamp
  received_at             timestamp (nullable)
  resolved_at             timestamp (nullable)
  rejected_reason         text (nullable)
  staff_id                string (nullable, only if escalated)
```

### 3.6 Integration points

- **Shopify.** Return creates a refund record via Admin API. Exchange creates a new draft order linked to the original.
- **Credits ledger.** Store credit issuance flows through `credits_ledger` (CRM spec §6.5) as `issued_manual` type with `reason = "return_credit"`.
- **Klaviyo.** Flow triggered on return request → shipping label email, status update emails, resolution email.
- **CRM timeline.** Every return event logged: requested, label sent, received, resolved. Plus the reason code — this data is gold for product QA.

### 3.7 Reporting

New report module in CRM (`/reports/returns`):

- Return rate by product (find problem frames)
- Return rate by reason (systemic issues?)
- Return rate by tier (members returning more or less?)
- Average time to resolution
- Exchange-to-refund ratio

### 3.8 Brand-grade follow-up

For high-value returns ($300+) or multi-return customers, a triggered CRM task: optician reaches out within 72 hours of return resolution. Not to sell, just to understand.

This is the "warm touch after the cold system" principle.

### 3.9 Priority

High. V2.0 scope. Reduces ops cost and improves customer experience simultaneously.

---

## 4. Customer service macros

### 4.1 What it is

A library of pre-written response templates for common customer inquiries, accessible from the CRM interaction timeline. Staff click "Insert macro" while composing an email or SMS, select from a categorized list, and the template fills in with customer-specific variables.

### 4.2 Why it matters

Without macros, every staff member types the same 20 responses differently. Response quality and brand voice drift. Response time balloons. Macros enforce consistency and cut response time by 60-80%.

The fear is that macros feel templated. The fix is macros written in Lunettiq's voice, updated regularly, with required variable fields that force personalization.

### 4.3 Macro categories

Structured taxonomy, not a flat list:

**Rx and prescription**
- Rx verification pending — initial
- Rx verification pending — delayed
- Rx discrepancy found — request clarification
- Prescription too old — renewal request
- Prescription unclear on uploaded file

**Shipping and delivery**
- Order confirmation follow-up
- Shipping delayed — no fault
- Shipping delayed — customs (international)
- Lost in transit — reship process
- Wrong address — correction flow

**Returns and exchanges**
- Return request received — standard
- Return rejected — damage
- Exchange in progress — timing
- Refund processed
- Store credit issued

**Product and fit**
- Fit advice — too loose
- Fit advice — too tight
- Colour variation explanation
- Frame materials explanation
- Lens options explanation

**Loyalty and membership**
- Membership welcome
- Trial conversion prompt
- Credit expiry warning
- Referral confirmation — referrer
- Referral confirmation — referred
- Tier upgrade welcome

**Technical and account**
- Password reset help
- Account merge confirmation
- Email change confirmation
- Data export request (Law 25)

### 4.4 Variable fields

Every macro supports required and optional variables:

**Required (won't send without value):**
- `{customer_first_name}`
- `{order_number}` (where relevant)
- `{staff_first_name}` (auto-populated from Clerk)

**Optional (fallback if blank):**
- `{estimated_arrival_date}`
- `{product_name}`
- `{tier_name}`
- `{credits_balance}`
- `{named_optician_name}` (CULT+ only)

Staff see a warning if required variables are blank. The system blocks send until filled.

### 4.5 Storage and management

CRM-owned table:

```
message_macros
  id                uuid
  category          string (enum matching §4.3)
  title             string (internal name)
  channel           enum (email | sms | both)
  subject_template  text (email only)
  body_template     text
  required_vars     jsonb (array of variable names)
  optional_vars     jsonb
  last_updated_by   string (staff id)
  last_updated_at   timestamp
  use_count         integer (how many times used, for pruning)
  active            boolean
```

**Management UI.** `/settings/macros` in the CRM:
- List view with category filter, search, usage stats
- Editor with live preview using sample customer data
- Version history (last 5 edits retained)
- Permission: managers can create and edit, staff can use

### 4.6 Integration

- **Interaction timeline.** Macro-sent messages tagged as `type: email, via_macro: [macro_id]`. Reporting can track per-macro performance.
- **Klaviyo.** Macros for transactional/one-off messages send via Klaviyo API (CRM spec §10.9).
- **Mobile app.** Macros accessible on tablet for SAs sending post-fitting follow-ups.

### 4.7 Voice guidelines (documented with the feature)

A one-page brand voice doc lives alongside the macro library. Macros reference it. Quarterly review by the content lead or Benjamin ensures drift hasn't crept in.

Core rules:
- Canadian spelling always
- No em dashes
- Active voice, strong verbs
- Warm but not performative
- Specific over generic ("your Draper in tortoise" not "your order")
- Never close with "don't hesitate to reach out" — empty filler

### 4.8 Priority

Medium. V2.1. Lower urgency than returns self-service, but compounds fast once order volume scales past ~50/day.

---

## 5. In-store client-facing iPad mode

### 5.1 What it is

A tablet running a purpose-built Lunettiq app, mounted or handheld in the Montreal store, used by SAs *with* clients (not at them). Designed for two-person interaction.

Already listed in V3 of the CRM spec. This section elevates it to V2.2 scope with defined features.

### 5.2 Why it matters

The "selling with, not at" moment. A tablet changes the physical retail interaction from transactional to advisory. Reference: Apple Store Genius Bar, Aesop counter experience. Done poorly, it's a kiosk. Done well, it's a conversation tool.

For Lunettiq specifically, the tablet is where the CRM depth becomes visible to the customer. They see their preferences, their fit profile, their past purchases — proof that the brand remembers.

### 5.3 Modes

Three distinct modes, switchable by the SA:

**Discovery mode** (for walk-ins, not in CRM).
- Browse catalogue by category, shape, collection
- Filter by fit profile (if basic measurements captured)
- Swipe through On Faces imagery
- Save favourites to an email capture (creates a prospect record)

**Session mode** (for identified clients).
- SA signs in, loads client profile
- Split screen: catalogue on one side, client's preferences and history on the other
- Recommendations surface first ("Based on your last fitting...")
- Inline product details with fit confidence against client's measurements
- Add to in-session wishlist, which syncs to the client's account

**Fitting mode** (during an appointment).
- Photo capture of client trying each frame
- Notes per frame ("too wide", "loves the colour", "price hesitation")
- Comparison view — side-by-side photos of 3 frames
- Exit action: email the client the session summary with shortlisted frames

### 5.4 Hardware and app

**Hardware.** iPad Pro 12.9" (screen size matters for the two-person view), mounted on a swivel arm at the counter OR handheld in a leather case for walk-around use. Apple Pencil for staff notes.

**App.** Extension of the existing mobile app (CRM spec §19.1), not a separate codebase. Built in Expo/React Native. Same offline-sync behaviour as the SA tablet app. Same auth (Clerk).

**Camera.** Native iPad camera with a custom capture flow (square crop, auto-enhance, subject detection for face framing).

### 5.5 Client-facing UI rules

Different design constraints than the SA-only tablet app:

- Larger type (minimum 18pt for body, 32pt+ for headings)
- Higher contrast (client may not have their glasses on)
- No sensitive data visible (SAs hide membership dollar amounts, Rx details when client is looking)
- "Visible to client" toggle — hides admin fields in real time
- No internal tags visible ("VIP - tough to please" should never display client-side)

Privacy mode: tapping a toggle switches from SA view to client view. Client view shows only what's appropriate to share.

### 5.6 CRM integration

Every client-facing session creates a rich interaction timeline entry:

```
type: "in_store_session"
data: {
  duration_minutes: integer,
  frames_tried: [product_ids],
  photos_captured: [r2_urls],
  notes_per_frame: {...},
  shortlisted: [product_ids],
  purchased: [product_ids] | null,
  session_summary_emailed: boolean
}
```

Photos sync to client's private timeline — they can log into their account and see their fitting session, including the frames they tried.

### 5.7 Data capture moments

Strategic opportunities during a session to capture preferences without it feeling like a form:

- "Which one felt best?" — captures stated preference
- "What didn't work about this one?" — captures `avoid` reasons
- Fit measurements taken during session → saved to client profile
- Photo of client in winning frames → added to profile (with consent)

Consent is captured explicitly for photo storage. "Can we save this photo to your account?" as a toggle.

### 5.8 Priority

Medium. V2.2 scope. Dependent on physical retail expansion. If Montreal stays as the only location, one tablet is enough. If second store opens, priority increases.

---

## 6. Wishlist with in-store integration

### 6.1 What it is

Customer saves frames to a wishlist online. When they visit the Montreal store, the SA sees their wishlist on the client profile and has the items pre-pulled and waiting at the counter.

### 6.2 Why it matters

The online-to-in-store bridge is the hardest channel transition for DTC brands. Warby Parker's home try-on is their version of this. Lunettiq's version is: wishlist online, try in store.

This only works because Lunettiq has (or will have) physical retail AND a robust CRM. CHIMI, Jimmy Fairly, and most DTC players can't do this at the same quality.

### 6.3 Customer-facing flow

**Saving to wishlist.**
- Heart icon on PDP, PLP cards, and search results
- Saves silently for logged-in users
- For guests, prompts account creation on second save
- Saved items visible at `/account/wishlist`

**Wishlist page.**
- Grid of saved frames
- Status indicator per item: In stock at [home location] / In stock at other location / Out of stock / Back in stock date
- Quick actions per item: Book an appointment to try these · Add to cart · Remove

**Multi-wishlist (V2.1 refinement).** Customer can create named lists ("Work frames", "For the wedding", "Maybe"). Default list on first save. Named lists shareable via URL.

### 6.4 Booking integration

From wishlist, "Book an appointment to try these" opens the appointments booking flow with the wishlist items pre-selected as frames of interest (see feature 2, inventory hold).

Flow:
- Customer selects up to 3 wishlist items
- Books appointment at their home_location
- Inventory holds placed on selected items
- Pre-appointment reminder email lists the held frames

### 6.5 In-store experience

When a customer arrives at the store:

**Check-in flow.** SA enters the customer's name or scans their loyalty QR code (V2.2). The client profile loads, including wishlist.

**Prep notification.** If the customer has an appointment with wishlist items held, a dashboard notification appears earlier in the day: "M. Willem arriving at 14:30 — pull Draper (Tortoise), Senna (Black), Astoria (Crystal) from stock."

**Session integration.** The iPad mode (feature 5) loads the wishlist as the starting session view. "Here are the frames you saved — should we start with these?"

### 6.6 Data model

CRM-owned table:

```
wishlists
  id               uuid
  customer_id      string
  name             string (default "My Wishlist")
  shareable_slug   string (for URL sharing, nullable)
  is_default       boolean
  created_at       timestamp

wishlist_items
  id               uuid
  wishlist_id      uuid (FK)
  shopify_variant_id string
  added_at         timestamp
  notes            text (customer notes on why they saved it)
```

### 6.7 Integration points

- **Back in stock alerts.** When an out-of-stock wishlisted variant comes back in stock, Klaviyo flow triggers (email + optional SMS for opted-in).
- **Price change alerts.** If a wishlist item goes into a collab drop or gets repriced, notification to the customer.
- **CRM timeline.** Wishlist adds/removes logged as interactions. Useful signal for intent.
- **Segmentation.** New segment attribute: "Has wishlisted [product/collection]" for targeting.
- **Recommendations.** Wishlist items weighted heavily in the derived preferences model (CRM spec §7.2).

### 6.8 Social / sharing

Sharing a wishlist via URL is V2.2:
- Shareable slug: `lunettiq.com/w/abc123`
- Recipient sees a stripped-down view (no customer name, just the saved frames)
- Useful for "help me choose" moments with friends or partners

### 6.9 Priority

High if serious about omnichannel. V2.1 for customer-facing, V2.2 for in-store integration.

---

## 7. Sequencing and dependencies

Not all features ship together. Here's the order that makes sense given dependencies and effort.

### 7.1 V2.0 (with customer accounts launch)

- **Return / exchange self-service** (feature 3) — highest ops ROI
- **Wishlist — customer-facing only** (feature 6, sections 6.1-6.4, 6.7)

### 7.2 V2.1 (4-8 weeks post V2.0)

- **Customer service macros** (feature 4) — depends on order volume justifying the investment
- **Inventory hold on appointment booking** (feature 2) — depends on appointments V2 being live
- **Journal** (feature 1) — depends on content lead being in place

### 7.3 V2.2 (3-6 months post V2.0)

- **In-store iPad mode** (feature 5) — depends on retail expansion or dedicated launch
- **Wishlist in-store integration** (feature 6, sections 6.5 and 6.8)

### 7.4 Dependency map

```
Accounts launch (V2.0)
        |
        ├── Returns self-service ──── [ships V2.0]
        ├── Wishlist customer ──── [ships V2.0]
        |
Appointments V2
        |
        ├── Inventory holds ──── [ships V2.1]
        |
Order volume >50/day
        |
        ├── CS macros ──── [ships V2.1]
        |
Content lead hired
        |
        ├── Journal ──── [ships V2.0 or V2.1]
        |
Retail expansion OR dedicated retail push
        |
        ├── iPad in-store mode ──── [ships V2.2]
        └── Wishlist in-store ──── [ships V2.2]
```

---

## 8. Open decisions

Each needs an answer before build on the respective feature.

| # | Feature | Decision | Options | Recommendation |
|---|---|---|---|---|
| 1 | Journal | Content ownership | A: Retained editor (part-time). B: Full-time hire. C: Agency. | **A** for year 1. B if content drives >15% of acquisition. |
| 2 | Journal | CMS | A: Shopify blog native. B: Headless (Sanity/Contentful). | **A** for V2.0. B only if editorial complexity demands it. |
| 3 | Inventory holds | Hold duration | A: 24h before / 2h after. B: 48h before / 4h after. C: Tier-weighted. | **C** — 24/2 for non-members, 48/4 for VAULT. |
| 4 | Returns | Rx return policy | A: 50% refund default. B: Store credit only. C: Full refund. | **A** — matches industry, protects margin. |
| 5 | Returns | Store credit bonus | A: Flat 10% bonus. B: Tier-weighted (5/10/15/20%). | **B** — reinforces loyalty program. |
| 6 | Returns | Free return shipping | A: All customers. B: Members only. C: Never (charge). | **B** — members free, non-members $8. |
| 7 | Macros | Editorial review cadence | A: Monthly. B: Quarterly. | **B** — monthly is overhead, quarterly catches drift. |
| 8 | iPad mode | Hardware approach | A: Mounted at counter. B: Handheld roaming. C: Both. | **C** — mounted for sessions, handheld for walk-throughs. |
| 9 | iPad mode | Photo consent | A: Opt-in per photo. B: Opt-in once, applies forever. C: Opt-out. | **A** — regulatory safety under Law 25. |
| 10 | Wishlist | Multi-list support | A: Single default list only. B: Multi-list from launch. | **A** for V2.0, **B** for V2.1 — keeps V2.0 simple. |
| 11 | Wishlist | Guest wishlist | A: Require account. B: Anonymous wishlist with localStorage. | **A** — forces account creation, better data capture. |
