# Lunettiq — iPad App Specification

**Stack:** Expo (React Native) · WatermelonDB (SQLite) · Clerk Native SDK · TanStack Query · Zustand · Postgres (via CRM API) · Cloudflare R2
**Status:** Draft v1.0
**Last updated:** April 2026
**Cross-references:** `lunettiq-crm-spec.md` §19 (mobile app) · `lunettiq-crm-spec.md` §4.7 (offline sync) · `lunettiq-next-improvements-spec.md` §5 (client-facing mode) · `01-appointments.md` · `lunettiq-clerk-permissions.md`

---

## Framing

The iPad app is where Lunettiq's CRM depth becomes visible to the customer. Web CRM is for managers at a desk. Phone app is for quick checks between appointments. The iPad is the one surface where a sales associate and a client look at the same screen, together, during a fitting.

That dual-purpose constraint shapes everything. Every screen has to work in two modes: staff-only (full data, internal notes, pricing detail) and client-visible (curated, safe to share, absence of private information). Both modes share a codebase. The toggle is global and reversible.

Shopify remains the source of truth. The iPad never writes directly to Shopify — writes flow through the CRM API. Offline tolerance is a hard requirement because store connectivity is never guaranteed. Writes queue locally and sync on reconnect.

**Design principles:**
- Two-person device. Designed for the SA and the client to use together.
- Privacy mode is one tap away. Never accidentally leak internal data to a client.
- Offline-first. Every core workflow works without internet.
- No keyboard required for the primary flows. Typing is the last resort.
- The photo is the document. Fittings are visual; capture what the client wore.
- Every session creates a rich timeline entry. Nothing that happens on the iPad should be invisible to the rest of the CRM.

---

## Contents

1. [Hardware and platform](#1-hardware-and-platform)
2. [Auth and session model](#2-auth-and-session-model)
3. [Modes — staff vs client-visible](#3-modes--staff-vs-client-visible)
4. [Information architecture](#4-information-architecture)
5. [Discovery mode — walk-ins](#5-discovery-mode--walk-ins)
6. [Session mode — identified client](#6-session-mode--identified-client)
7. [Fitting mode — in-appointment](#7-fitting-mode--in-appointment)
8. [Product browser](#8-product-browser)
9. [Second Sight intake](#9-second-sight-intake)
10. [Custom design capture](#10-custom-design-capture)
11. [Client management](#11-client-management)
12. [Appointments on iPad](#12-appointments-on-ipad)
13. [Photo capture and media](#13-photo-capture-and-media)
14. [Offline sync model](#14-offline-sync-model)
15. [Data model additions](#15-data-model-additions)
16. [Permissions model](#16-permissions-model)
17. [Performance and UX constraints](#17-performance-and-ux-constraints)
18. [V1 scope vs V2 roadmap](#18-v1-scope-vs-v2-roadmap)
19. [Open decisions](#19-open-decisions)

---

## 1. Hardware and platform

### 1.1 Target device

**iPad Pro 12.9" (6th gen or later).** Screen size matters for the two-person viewing pattern. Smaller iPads feel cramped when both SA and client are looking. Liquid Retina XDR handles the editorial photography the brand depends on.

### 1.2 Form factor

**Handheld only.** All iPads deployed in leather cases for walk-around use. No mounted counter units.

Rationale: a single form factor simplifies procurement, training, and fleet management. The mounted unit's stability advantages don't outweigh the operational cost of maintaining two device modes. Handheld units adapt to every use case — seated consultations, walk-around discovery, photo capture, Second Sight intakes — with one consistent setup.

Recommended per store: 2-3 handheld units depending on daily traffic. One always in use, one on charge, one as backup.

### 1.3 Peripherals

- **Apple Pencil 2** — optional. Recommended for stores running custom designs regularly. Used for sketching frame concepts, marking up photos during fittings, signature capture on high-ticket orders.
- **Leather case** — brand-aligned, protects the device during photo capture and floor use. Magnetic stand feature for seated consultations.
- **Charging dock** — in a back-of-house location, rotation setup so one unit is always full-charged and ready.

### 1.4 Platform constraints

- **iOS 17+** required (SwiftUI compatibility via Expo, camera API features)
- **WiFi + cellular** on all units. Cellular serves as fallback for photo upload when store WiFi drops, and enables the handheld units to operate anywhere in the store without dead zones.
- **Battery life** — must last a full shift (8 hours) without charge. Optimize screen brightness auto-dim, disable unnecessary background tasks. Charging dock rotation in back-of-house covers longer shifts.

---

## 2. Auth and session model

### 2.1 Login flow

Same Clerk-based auth as the phone app (CRM spec §9):

1. Staff opens app first time → Clerk sign-in (email + password or Google SSO)
2. MFA required for managers and owner roles
3. Biometric unlock enrolled (Face ID / Touch ID)
4. Location assignment derived from Clerk public metadata

Subsequent opens: biometric unlock → app.

### 2.2 Session timeout

Three timeout layers:

| Timeout | Trigger | Behaviour |
|---|---|---|
| Screen lock | 2 min inactivity | Biometric re-auth to unlock |
| App session | 30 min inactivity | Return to home screen, preserve local state |
| Full sign-out | 14 days without activity | Clerk token refresh required |

Staff shift change: explicit "Sign out" action from Settings. No automatic user switching — prevents accidental attribution of actions to wrong staff.

### 2.3 Shift handoff

Quick biometric switch for busy stores where iPads get passed between SAs throughout a shift:

- SA taps "Pass to colleague" → colleague presents face or touch for biometric auth
- Current session state preserved (active client, fitting in progress, unsaved notes)
- Audit trail records the handoff with timestamp and both SA identities
- New SA sees a banner on first screen: "Continuing [Client] session started by [Previous SA]"

The handoff is explicit. No silent re-attribution. Every interaction logs to the SA who was active when it occurred, not to the current signed-in user — if SA A captures a photo during a session and SA B takes over to complete the purchase, the photo is attributed to A, the purchase to B.

Full sign-out remains available for end-of-shift. Quick switch is for same-shift rotation between SAs.

### 2.4 Location lock

The iPad is bound to a specific store location in settings. SAs signed in at that iPad are automatically scoped to that location for new records (appointments created, intakes logged). Managers can override the location on a per-record basis.

---

## 3. Modes — staff vs client-visible

### 3.1 The two modes

**Staff mode (default).** Everything visible. Internal notes, tags, LTV, credits balance, preferences (stated and derived), Rx details, purchase history with prices, return rate.

**Client-visible mode.** Curated view. Hides:
- Internal tags ("VIP - demanding", "return-prone")
- LTV and AOV
- Credits dollar amount (shows "$XX in credits" rounded, or hides entirely)
- Return rate
- Private staff notes
- Cross-client data (other customers' purchases, segment memberships)
- Pricing on frames the client hasn't committed to

Client-visible mode shows:
- Client's own name and basic profile
- Their wishlist and past purchases
- Their fit profile (measurements, face shape)
- Their stated preferences
- Product catalogue (without pricing until decision point)
- Fitting session photos (their own)

### 3.2 Toggle mechanism

A single toggle in the top-right corner of every screen: a small eye icon.

- Staff mode: filled eye, warm colour
- Client-visible mode: eye with a slash, prominent visual indicator

Toggle is global — switches all screens at once. Reversible in one tap.

Visual treatment: a subtle coloured bar at the top of the screen changes colour when client-visible mode is active. SAs can't miss it. If they open an internal note panel while client-visible mode is on, the panel is greyed out with a prompt to switch modes.

### 3.3 "Hand to client" action

A discrete action: "Hand to client." Activates client-visible mode plus a simplified navigation chrome (hides sidebar, enlarges touch targets, reduces text density). Intended for when the client takes the iPad to do something — browse frames, pick favourites, review session photos.

Exit: physical button press (double-tap home), reverts to staff mode with biometric confirm.

### 3.4 Per-screen rules

| Screen | Staff mode | Client-visible mode |
|---|---|---|
| Client profile | Full profile | Name, wishlist, fit profile, preferences |
| Product detail | All data + inventory + sales history | Product info, frame details, prices hidden until tap |
| Fitting session | Notes editable | Photos visible, notes hidden |
| Catalogue browse | Full filters + pricing | Browse only, prices shown on tap |
| Second Sight intake | Full grade + internal notes | Intake confirmation screen only |
| Cart / order review | Full detail | Final summary only |
| Settings | Full access | Blocked |
| Audit log | Blocked | Blocked |

---

## 4. Information architecture

### 4.1 Home screen

Role-aware home:

**SA default:**
- Today's appointments (count + next up)
- Active holds at this location (frames reserved for upcoming appointments)
- Recent clients (last 5 viewed)
- Quick actions: Search client · New client · Browse products · Start Second Sight

**Manager default:** (same as SA, plus)
- Today's session count
- Second Sight queue at this location
- Custom designs pending review

### 4.2 Navigation

Bottom tab bar (iPad-appropriate for thumb reach):

| Tab | Purpose |
|---|---|
| Home | Today view, quick actions |
| Clients | Search, list, create |
| Products | Catalogue browser |
| Appointments | Today's calendar + week view |
| More | Second Sight, Custom designs, Reports (role-gated), Settings |

Sidebar (collapsible on iPad in landscape):
- Expanded view of More tab items
- Location switcher (managers can switch between their assigned locations)
- Sync status indicator
- Mode toggle (staff / client-visible)

### 4.3 Global search

Pull-to-reveal search bar at the top of any tab. Searches across:
- Clients (name, email, phone)
- Products (title, handle, SKU)
- Appointments (today + next 7 days)
- Open intakes (Second Sight, custom design)

Results categorized, keyboard-friendly, works offline against local SQLite.

---

## 5. Discovery mode — walk-ins

### 5.1 When to use

A customer walks in without an appointment. Not identified in the system. Wants to browse.

### 5.2 Flow

1. SA taps "New walk-in" from home or products tab
2. App enters discovery mode (no client attached)
3. SA and client browse the catalogue together
4. At the end, SA offers to capture the customer's email: "Would you like us to remember what you liked today?"
5. If yes: lightweight form (name, email, optional phone) creates a prospect record
6. The browse session (products viewed, frames tried, favourites) is attached to the new prospect
7. If no: session data is discarded

### 5.3 Discovery-mode UI

Bottom bar while browsing:
- "Favourites (N)" — tap to review
- "Tried in person (N)" — tap to review with photos
- "Capture details →" — closing action

Every product viewed for more than 5 seconds logs silently in a session buffer. Photos captured during discovery attach to the session.

### 5.4 Prospect record creation

Creates a Shopify customer with:
- Minimal profile (email required)
- Tag: `prospect` + `walkin-YYYY-MM-DD`
- Home location: current iPad's location
- Attached interaction: "Walk-in session" with duration, product list, photos

Flows into Klaviyo (with explicit consent) for a soft follow-up sequence.

### 5.5 Conversion to full client

The prospect record behaves like a lightweight client record. First purchase automatically upgrades them. No "prospect to client" conversion action needed — the data model is unified.

---

## 6. Session mode — identified client

### 6.1 When to use

Client arrives with an appointment OR returning client walks in and is identified. All subsequent activity attributes to their profile.

### 6.2 Starting a session

Three entry points:

1. **From today's appointments.** Tap appointment → "Start session." Client profile loads, inventory holds auto-surface.
2. **From client search.** Search name → open profile → "Start session."
3. **From check-in (V2).** Client scans a QR code at the counter or provides their phone number → SA confirms identity → session starts.

### 6.3 Session workspace layout

Split screen (landscape only):

**Left panel (60%):** Browsable catalogue, product detail, or fitting photos — contextual to current task.

**Right panel (40%):** Client context:
- Name, tier badge, home location
- Fit profile (face shape, measurements, last fitting date)
- Stated preferences (shapes, colours, materials, avoid list)
- Derived preferences (top 3 shapes/materials from purchase history)
- Recent orders (last 3 with thumbnails)
- Wishlist (expandable)
- Today's session notes (editable live)

Right panel collapses on portrait orientation or when "Hand to client" is active.

### 6.4 Session activity capture

Every action during the session adds to a structured session object:

```
session = {
  id: uuid,
  client_id: string,
  staff_id: string,
  location_id: string,
  appointment_id: uuid | null,
  started_at: timestamp,
  ended_at: timestamp | null,
  
  products_viewed: [{ product_id, duration_seconds }],
  frames_tried: [
    {
      product_id,
      variant_id,
      photos: [r2_url],
      duration_seconds,
      verdict: "loved" | "liked" | "unsure" | "rejected" | null,
      notes: string
    }
  ],
  
  shortlisted: [product_id],
  wishlisted: [product_id],
  
  preferences_updated: {
    stated: { before, after },
    fit_profile: { before, after }
  },
  
  products_recommended: [{ product_id, reason, via: "sa_recommendation" }],
  
  outcome: "purchased" | "shortlist_emailed" | "second_visit_booked" | "left_empty" | null,
  purchase_order_id: string | null,
  
  summary_email_sent: boolean,
  session_notes_internal: text
}
```

### 6.5 Ending a session

"End session" action at top of screen. Prompts:

1. **Outcome selector.** Did the client purchase, book another visit, shortlist for home review, or leave empty-handed?
2. **Session summary email.** Optional: send the client an email with photos, shortlisted frames, and next steps. Pre-populated from session data, editable before sending.
3. **Internal notes.** Private staff notes added to the client's interaction timeline.

Session object saves to CRM, interaction timeline entry created, client profile updated with any preference changes.

### 6.6 Session recovery

If the iPad crashes or the SA accidentally exits mid-session:
- Session auto-saves every 30 seconds to local SQLite
- On reopen, prompt: "Resume session with [Client] started at [time]?"
- Data persists through app crashes, device restarts, and offline periods

---

## 7. Fitting mode — in-appointment

### 7.1 When to use

Sub-mode of session mode, activated when the SA and client start physically trying frames. Optimizes the UI for photo capture and comparison.

### 7.2 Activation

From session mode → "Start fitting." Changes the left panel to a camera-first view with a shelf of tried frames below.

### 7.3 Fitting UI

**Top area:** Live camera feed, face-framed with a subtle guide overlay (not AR, just a composition aid).

**Capture action:** Large central button. Each capture:
- Shoots 3 frames (burst) → picks sharpest
- Prompts for product/variant linkage: "Which frame is this?" (typeahead from catalogue)
- Saves to session under `frames_tried`
- Thumbnail appears in the shelf below

**Shelf row:** Horizontal scroll of thumbnails, one per frame tried. Tap any to:
- See larger photo
- Add notes ("too wide at temples", "loves the colour")
- Mark verdict (loved / liked / unsure / rejected)
- Add to shortlist

**Comparison view:** Select 2-4 thumbnails → "Compare" → side-by-side grid with notes visible. The "which one?" moment, visualized.

### 7.4 Linking photos to products

Photo → product linkage is the data point that matters. Three paths:

1. **Barcode scan.** Physical tag on frame has a SKU barcode. iPad camera scans it before photo. Product auto-linked.
2. **Manual search.** SA types the first letters of the model name, picks from typeahead.
3. **Later attribution.** Photos captured without linkage queue in the session. SA attributes before ending session.

Barcode is the fastest path at scale. V1 supports all three.

### 7.5 Client review

At any point, SA taps "Hand to client" → client sees the fitting shelf with photos, can tap to enlarge, mark their own verdicts. Adds a layer of client voice to the session data.

### 7.6 Private vs client-visible photo storage

All photos captured in fitting mode are stored in R2 with two URLs:
- **Internal URL** — staff-accessible, includes SA notes overlay
- **Client URL** — clean version, client-accessible via their account

Consent requirement: before the first photo of a session, the SA confirms with the client: "Can we save photos of today's fitting to your account?" Stored as session consent (valid for that session only). Next session asks again.

### 7.7 Export options

End-of-session actions specific to fitting mode:
- **Email to client** — shortlisted frames with photos attached
- **Save to client account** — persists in their account page
- **Print session card** — physical takeaway with 3 shortlisted frames (V2, requires in-store printer)
- **Hold frames for decision** — places 48-hour soft holds on shortlisted frames so the client can decide at home

---

## 8. Product browser

### 8.1 Purpose

Browse the full catalogue with filters. Accessible standalone (from the Products tab) or inside a session (catalogue browse for the active client).

### 8.2 Browse view

Grid layout optimized for iPad:
- 3 columns in portrait, 4 in landscape
- Product card: image, name, price (hidden in client-visible mode until tap), colour count

Filters (top bar, horizontal scroll):
- Collection (Signature, Permanent, Archives, Collaborations)
- Shape (Round, Square, Oval, Cat-eye)
- Material (Acetate, Metal)
- Colour (swatch picker)
- Size (Small, Large)
- Available at [this location] / All locations (toggle)

Sort options:
- Newest
- Price low-high (staff mode only)
- Price high-low (staff mode only)
- Best match (uses active client's derived preferences, if in session)

### 8.3 Product detail

Full-screen product view:

**Top area:** Large image with variant thumbnails (colours).

**Middle area:**
- Name, model code, collection
- Price (hidden in client-visible mode, shown on tap)
- Fit dimensions (frame width, lens width, bridge, temple)
- Materials and origin
- Lens compatibility

**Bottom area (staff mode only):**
- Inventory at this location
- Inventory at other locations
- Sales history (last 30 days, last 12 months)
- Return rate
- Common customer feedback pulled from returns data

**Actions:**
- Try in fitting (jumps to fitting mode)
- Add to client wishlist (if in session)
- Recommend to client (creates interaction entry + optional follow-up email)
- Start custom design based on this frame
- Check inventory at other locations (for transfer request)

### 8.4 Inventory transfer request (V2)

If a frame the client wants is out of stock at this location but available elsewhere, SA can trigger a transfer request. Creates a task for the other location's manager, estimated arrival 2-3 days. V2 scope — requires operational process.

### 8.5 Best-match algorithm

In session, the product browser can be filtered to "Best for [client]." Uses the suggestions API (existing spec 05 — Product Recommendations):

- Weights face shape match
- Weights stated preferences (shapes, materials, colours)
- Weights derived preferences from purchase history
- Excludes already-purchased products
- Demotes products on client's `avoid` list
- Boosts products in their price band

Each result surfaces with match reasons: "Matches your preferred round shape · Acetate, like your Senna frames · Available in your home location"

---

## 9. Second Sight intake

### 9.1 Purpose

Capture a trade-in intake during a client visit. Already spec'd in CRM spec §15; the iPad version is optimized for the in-store capture workflow.

### 9.2 Entry point

From client profile → "Start Second Sight intake" action.

### 9.3 Flow

**Step 1: Frame identification.**
- Scan barcode on original frame (if Lunettiq frame with internal SKU)
- OR search for the frame model in Lunettiq catalogue (for Lunettiq frames)
- OR manual entry (for non-Lunettiq frames — V2 accepts competitor brands at lower rate)

**Step 2: Condition photos.**
- 4 required photos: front, 3/4 angle, temple detail, lens close-up
- Guided capture — overlay shows expected framing
- Each photo re-takeable

**Step 3: Grading.**
- SA inspects frame, selects Grade A / B / C
- Grade rubric visible as reference (from CRM admin spec §5.2)
- Notes field for condition specifics ("minor scratch on left lens", "hinge loose")

**Step 4: Credit calculation.**
- Based on grade × tier multiplier × frame MSRP
- Shown to client: "Your trade-in value: $XX credit" or "Donate and earn 100 Lunettiq Points"
- Client-facing summary screen if in client-visible mode

**Step 5: Client decision.**
- Accept credit
- Donate (Grade C option)
- Decline and keep frame

**Step 6: Completion.**
- Physical frame placed in Second Sight intake bin
- Digital intake moves to "received" status in CRM
- Credit pending approval by manager (for grades that affect credit value materially — spec §15)
- Client receives confirmation email

### 9.4 Offline-tolerant

All steps work offline. Photos queue for upload. Grade + credit calculation uses local tier/grade tables. Approval workflow triggers on reconnect.

---

## 10. Custom design capture

### 10.1 Purpose

Start a custom frame design during a client visit. Full workflow lives in the CRM (spec §18); the iPad captures the initial intake.

### 10.2 Flow

**Step 1: Reference.**
- Client shows a frame they like (could be Lunettiq, could be competitor, could be a drawing)
- SA captures photo(s) — up to 6 references
- OR picks an existing Lunettiq frame as the base

**Step 2: Modifications.**
- Shape notes (rounder, more angular, narrower)
- Colour (swatch picker from available materials)
- Size adjustments (wider, narrower, taller lenses)
- Special features (custom engraving, unusual hinge, specific bridge style)
- Free-form notes with Apple Pencil sketch support

**Step 3: Measurements.**
- Auto-populates from client's fit profile if available
- Allows override per-project
- Critical measurements: frame width, lens shape dimensions, bridge, temple length

**Step 4: Quote estimate.**
- Rough price range shown (from custom design templates)
- Lead time estimate (typically 6-12 weeks)
- Deposit required (50% of estimated total)

**Step 5: Submission.**
- Draft saves to CRM custom designs queue
- Routes to Benjamin for review and approval
- Client receives email with draft summary

### 10.3 Apple Pencil integration

Sketch-friendly canvas for the SA or client to draw modifications on top of reference photos. Sketches save as SVG + rasterized PNG for email handoff.

### 10.4 Photo handling

Reference photos can include third-party brands. Storage is for internal reference only — never used in Lunettiq marketing, never shared without client consent.

---

## 11. Client management

### 11.1 Client search

Primary entry point from Clients tab or global search:
- Typeahead on name, email, phone
- Recent clients (last 20 viewed by this SA)
- Today's appointments (pinned at top if any)
- Filter: this location only / all locations

Works offline against local SQLite cache.

### 11.2 Client profile view

Mirrors the web CRM's three-column layout (spec §12.1) but restacked for iPad:

**Top band (sticky):** Identity card — avatar, name, tier badge, credits balance (staff mode), contact.

**Main area (scrollable):** Context panels, collapsible:
- Fit profile
- Preferences (stated + derived, side by side)
- Recent orders (last 3 with photos)
- Wishlist
- Second Sight history
- Custom design drafts
- Interaction timeline (filterable)
- Internal notes (staff mode only)

### 11.3 Primary actions

Right-edge action bar:
- Start session
- Book appointment
- New Second Sight intake
- Start custom design
- Recommend product
- Add note
- More (export, merge, archive — role-gated)

### 11.4 Inline editing

Every field editable on tap. Measurements, preferences, consent toggles, tags — all write through the CRM API, optimistic UI locally.

Consent toggles require a confirmation modal (regulatory weight, CRM spec §12.3).

### 11.5 Client creation

"New client" from Clients tab:
- Required fields: first name, last name, email
- Optional: phone, address, birthday, pronouns, home location (defaults to iPad's location)
- Consent capture for email marketing (explicit opt-in required, with confirmation script the SA reads aloud)
- Saves immediately to CRM (queued if offline)

### 11.6 Duplicate prevention

Real-time duplicate check as SA types:
- Exact email match → blocks creation, surfaces existing client
- Exact phone match → blocks creation, surfaces existing client
- Similar name + same first letter of email → shows potential matches, SA confirms new client

---

## 12. Appointments on iPad

### 12.1 Purpose

Day-of appointment management. Full scheduling lives in web CRM (spec 01); the iPad version is operational — check in, update status, run the session.

### 12.2 Today view

Home screen shows today's appointments as cards:
- Client name and photo
- Time and duration
- Appointment type (fitting, eye exam, Second Sight, custom design consultation)
- Status (scheduled / confirmed / in progress / completed / no-show / cancelled)
- Frames held for this appointment (if any)
- Quick actions: Check in · Start session · Mark no-show

### 12.3 Check-in flow

When client arrives:
1. SA taps "Check in" on their appointment card
2. Status updates to "in progress"
3. Inventory holds become visible on home screen for prep
4. Tapping the card → client profile with session ready to start

### 12.4 Walk-through of expected workflow

```
09:00 — SA opens iPad, sees 6 appointments today
09:45 — Sets up for 10:00 appointment, taps "Prep frames" on card
         → shows 3 frames held, SA pulls them from stock
10:05 — Client arrives, SA taps Check in
10:05 — Taps Start session → client profile loads with held frames highlighted
10:07 — Starts fitting mode, client tries Frame 1
10:12 — Photo captured, SA notes "Great fit, loves the colour"
...
10:40 — Client decides on Frame 2, SA taps End session
        → outcome: purchased
        → proceeds to checkout (via web POS or in-store system)
10:42 — Session summary email auto-sends (with client consent)
10:45 — Appointment marked completed, iPad returns to home
```

### 12.5 Walk-ins during appointments

Walk-in customers and scheduled appointments run on separate iPad instances when staffing allows. A second SA with a second iPad runs discovery mode for the walk-in while the first SA stays on the appointment. If only one iPad or SA is available, the walk-in waits or books a later slot — this is a staffing problem, not a software one.

---

## 13. Photo capture and media

### 13.1 Photo usage contexts

The iPad captures photos in several contexts:
- Fitting sessions (client wearing frames)
- Second Sight intakes (condition documentation)
- Custom design reference (inspiration frames)
- Custom design sketches (Apple Pencil output)
- Client profile photo (with consent)

Each has different storage, retention, and consent rules.

### 13.2 Capture UI

Universal capture component:
- Live view with subject-framing overlay
- Tap to focus
- Volume buttons act as shutter (handheld shooting)
- Burst mode for fitting shots (3 frames, pick sharpest)
- Pencil annotation after capture

### 13.3 Storage

- **Local:** SQLite + local filesystem for offline access (purged after successful upload)
- **Cloud:** Cloudflare R2 in Canadian region (Law 25 compliant)
- **Access URLs:**
  - Signed URL for staff (expires in 1 hour, refreshed via CRM API)
  - Signed URL for client account (expires in 24 hours, refreshed on account view)

### 13.4 Retention

| Photo type | Default retention | Rationale |
|---|---|---|
| Fitting session photos | 2 years | Covers customer relationship span, tied to purchase decisions |
| Second Sight intake | 5 years | Dispute protection, Quebec retention norms |
| Custom design reference | Project life + 1 year | Reference during design, archive after |
| Client profile photo | Account lifetime | Consent-based, deletable by client |

Deletion triggers: client account deletion, explicit deletion request (Law 25 right to erasure), policy expiry.

### 13.5 Consent model

Three consent layers:

1. **Photo capture consent** — per session, verbal confirmation, staff logs confirmation
2. **Storage consent** — explicit, captured in client profile (persistent unless revoked)
3. **Marketing use consent** — separate, explicit opt-in, never defaulted

No photo is ever used in marketing without marketing consent specifically. Fitting photos default to private (client account only). Any promotion to "share-worthy" requires explicit re-consent.

### 13.6 Image quality and processing

- Resolution: 2048px on longest edge (balances quality with storage)
- Auto-crop to subject (face detection)
- Light colour correction (brightness, white balance)
- No filters, no beauty smoothing — the brand aesthetic depends on realism
- EXIF data stripped on upload (location, device info)

---

## 14. Offline sync model

### 14.1 What's cached locally

WatermelonDB (SQLite) on the iPad stores:

**Always:**
- Full product catalogue (~200 products, a few MB)
- Current staff profile + permissions
- Location metadata (hours, other locations, inventory snapshots)
- Tier configuration (credit multipliers, perks)

**Scoped:**
- Last 30 clients viewed by this SA (full profile + timeline + orders)
- Today's appointments + next 7 days
- Active sessions (including open Second Sight intakes and custom designs in draft)
- Last 90 days of client photos (referenced)

**Purged regularly:**
- Photos older than 7 days removed from device (available via CDN when online)
- Client profiles not accessed in 30 days dropped from cache
- Product catalogue refreshed fully every 24 hours

### 14.2 Offline write behaviour

Any write while offline:
1. Writes to local SQLite immediately (optimistic UI)
2. Queues in `pending_sync` table with full payload
3. Shows sync indicator in the app chrome (subtle, not alarming)
4. On reconnect, drains queue to CRM API in chronological order

**Write types that queue offline:**
- Session creation and updates
- Photo capture (uploads queue separately, larger payloads)
- Second Sight intake (photos + grade + notes)
- Client profile edits
- Appointment status changes
- Interaction timeline entries

**Write types that block offline:**
- New client creation with no email (requires duplicate check against live DB)
- Payment-adjacent actions (credits adjustments, custom design deposits)
- Permission-sensitive actions (role changes, consent edits on sensitive fields)

### 14.3 Conflict resolution

Newest-wins with audit trail. If a client profile edit happens on iPad offline at 10:00 and on web at 10:05, the web write wins (later timestamp), iPad's write is recorded in audit log as "superseded."

Exception: session objects — always win over concurrent edits because sessions are SA-owned and context-specific.

### 14.4 Sync status UI

Top-right indicator near the mode toggle:
- Green dot: synced, all caught up
- Yellow dot + number: N pending writes queued
- Red dot: sync error, tap to see details

Tapping the indicator shows:
- Pending writes with preview ("3 photos, 1 session update, 2 profile edits")
- Force sync button
- Last successful sync timestamp

**2-hour offline flag.** If the device has been offline for more than 2 hours with pending writes, the indicator shifts to an amber warning state and surfaces a non-blocking banner: "Offline for 2+ hours — find WiFi to sync [N] pending changes." The banner doesn't block work; it prompts the SA to find connectivity before queue size grows further. Logs a warning event for manager visibility.

### 14.5 Photo upload behaviour

Photos upload in background:
- On WiFi: immediately
- On cellular: queued, uploads when WiFi available (configurable)
- Failed uploads retry with exponential backoff
- User-visible progress for current session photos

Storage optimization: local compressed copy (500px) for thumbnail display even before full upload completes.

---

## 15. Data model additions

Additions beyond what's already in CRM spec §6. These are iPad-specific, all CRM-owned tables:

### 15.1 `sessions`

```
sessions
  id                    uuid
  shopify_customer_id   string (indexed)
  staff_id              string (indexed)
  location_id           string
  appointment_id        uuid (FK, nullable)
  device_id             string (iPad identifier)
  started_at            timestamp
  ended_at              timestamp (nullable)
  mode                  enum (discovery | session | fitting)
  outcome               enum (nullable)
  purchase_order_id     string (nullable)
  session_data          jsonb (full structured session object, see §6.4)
  summary_email_sent    boolean
  internal_notes        text
  created_at            timestamp
  updated_at            timestamp
```

### 15.2 `session_photos`

```
session_photos
  id                    uuid
  session_id            uuid (FK)
  shopify_variant_id    string (nullable — linked product)
  r2_url                text
  r2_key                text
  thumbnail_url         text
  captured_at           timestamp
  verdict               enum (loved | liked | unsure | rejected | null)
  notes                 text
  pencil_annotations    jsonb (nullable, SVG data)
  client_visible        boolean (default true)
  consent_captured_at   timestamp
  deleted_at            timestamp (nullable, soft delete)
```

### 15.3 `prospects`

Lightweight client record for walk-ins. Actually writes to Shopify customer with `prospect` tag, but iPad tracks the session attribution:

```
prospect_sessions
  id                    uuid
  shopify_customer_id   string (newly created prospect)
  session_id            uuid (FK to sessions, the walk-in session)
  converted_at          timestamp (nullable — when first purchase occurred)
  created_at            timestamp
```

### 15.4 `inventory_holds`

Already in next-improvements spec §2.3. Referenced here for completeness — the iPad reads and creates holds, doesn't define new schema.

### 15.5 `device_registry`

Tracking which iPad is where:

```
devices
  id                    uuid
  device_type           enum (ipad_handheld | iphone)
  device_identifier     string (iOS device ID)
  location_id           string
  last_seen_at          timestamp
  app_version           string
  os_version            string
  created_at            timestamp
```

No `assigned_to_staff_id` field — iPads are shared across SAs, not bound to individuals.

### 15.6 `sync_queue` (local SQLite only)

```
sync_queue
  id                    uuid (local)
  operation             enum (create | update | delete)
  entity_type           string (sessions, photos, clients, etc.)
  entity_id             string
  payload               json
  created_at            timestamp
  attempts              integer
  last_attempt_at       timestamp (nullable)
  error                 text (nullable)
```

Never synced to cloud — this is the queue itself. Items removed on successful sync.

---

## 16. Permissions model

iPad uses the same Clerk permissions as web (CRM spec §21, lunettiq-clerk-permissions.md).

### 16.1 Role access matrix

| Capability | Owner | Manager | SA | Read-only |
|---|---|---|---|---|
| Open iPad app | ✓ | ✓ | ✓ | ✓ |
| Discovery mode | ✓ | ✓ | ✓ | — |
| Start client session | ✓ | ✓ | ✓ | — |
| Fitting mode | ✓ | ✓ | ✓ | — |
| Capture photos | ✓ | ✓ | ✓ | — |
| Create clients | ✓ | ✓ | ✓ | — |
| Edit client profiles | ✓ | ✓ | ✓ | — |
| Toggle consent | ✓ | ✓ | ✓ | — |
| Start Second Sight intake | ✓ | ✓ | ✓ | — |
| Approve Second Sight grade | ✓ | ✓ | — | — |
| Start custom design | ✓ | ✓ | ✓ | — |
| Approve custom design | ✓ | — | — | — |
| View cross-location data | ✓ | own locations | current only | current only |
| Switch location | all | assigned | — | — |
| Access settings | ✓ | ✓ | — | — |
| View internal notes | ✓ | ✓ | ✓ | ✓ |
| Edit internal notes | ✓ | ✓ | ✓ | — |
| View LTV and financial metrics | ✓ | ✓ | — | ✓ |
| Hand to client (client-visible mode) | ✓ | ✓ | ✓ | — |

### 16.2 Role-specific home screens

**Owner:** Cross-location overview, no default store lock.
**Manager:** Today at their store(s), escalations, Second Sight queue.
**SA:** Today's appointments, active holds, quick actions.
**Read-only:** Client list + product browser only.

---

## 17. Performance and UX constraints

### 17.1 Performance budgets

| Action | p95 target |
|---|---|
| App cold start | < 2.5 sec |
| App warm start (from background) | < 0.4 sec |
| Client search result | < 300ms (local SQLite) |
| Product catalogue browse | < 150ms (local SQLite) |
| Photo capture to thumbnail | < 500ms |
| Photo upload to R2 (WiFi) | < 4 sec for 2MB |
| Session save to local SQLite | < 50ms |
| Mode toggle (staff ↔ client-visible) | < 100ms |

### 17.2 UX constraints

- **Type sizes:** body text minimum 17pt, headings 28pt+, target sizes 44pt minimum (Apple HIG compliance)
- **Contrast:** WCAG AA minimum, AAA for client-visible mode (client may not have glasses on)
- **Orientation:** landscape preferred for session/fitting modes, portrait supported for discovery and product browser
- **Split screen:** iPad split-view with another app supported but not optimized for
- **Dark mode:** supported, though store lighting conditions usually favour light mode
- **Reduced motion:** respected (iOS system setting)

### 17.3 Brand constraints

- Helvetica Now Display / Neue font stack (same as web)
- Dark navy (#0A153D) primary, deep green (#005D23) accent, warm off-white (#F5F2EC) background
- Editorial photography quality standards apply — no pixel-crunchy images, no stretched assets
- No emoji in system UI (brand register)
- No loading spinners longer than 2 seconds — show skeleton states instead

---

## 18. V1 scope vs V2 roadmap

### 18.1 V1 — with CRM mobile launch

- Auth and session model (Clerk + biometric)
- Shift handoff via quick biometric switch
- Staff mode (client-visible mode is V2)
- Home screen with today's appointments
- Client search, profile, creation
- Product browser with filters and inventory
- Session mode (identified client workspace)
- Fitting mode with photo capture and basic tagging
- Second Sight intake with photo capture and grading
- Custom design capture (intake only, review lives on web)
- Today's appointments + check-in flow
- Offline-tolerant reads and writes via WatermelonDB
- Sync queue and indicator with 2-hour offline warning
- Session summary emails (default on, consent-gated)
- Photo consent model with per-session capture
- Client photo visibility in client account (with consent)

### 18.2 V2 — 3-6 months post V1

- Client-visible mode with full toggle and "Hand to client" action
- Discovery mode for walk-ins (prospect capture)
- Barcode scanning for product and Second Sight identification
- Apple Pencil integration for custom design sketches
- Comparison view in fitting mode
- Inventory transfer requests
- Best-match algorithm filter in product browser
- QR code check-in for appointments
- Photo annotations with Pencil

### 18.3 V3

- AR-assisted fitting (frame overlay on live camera) — pending third-party evaluation
- Live video consultation mode (connect client to remote optician via iPad)
- Print session card to in-store printer
- Voice notes in sessions (transcribed via on-device ML)
- Multi-language UI (French for Quebec staff and bilingual clients)

### 18.4 Explicitly out of scope

- Phone app equivalence — phone app is its own simpler surface (CRM spec §19.2)
- POS functionality — Shopify POS remains the checkout system; iPad app doesn't process payments
- Signature capture for high-ticket orders — handled at POS
- Gift card redemption — POS handles
- Appointment creation from iPad — spawn from web CRM, iPad shows and operates
- Loyalty program enrollment (storefront handles it)

---

## 19. Resolved decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | **Device form factor** | **Handheld only.** All iPads deployed as handheld units in leather cases with WiFi + cellular. No mounted counter units. Simpler procurement, single operational mode. |
| 2 | **Photo storage quota per session** | **Cap at 20 photos per session.** Generous enough for thorough fittings, prevents runaway storage costs. |
| 3 | **Session summary email opt-in** | **Default on.** Consent captured at session start; client can decline at any point during the session. |
| 4 | **Shift switching between SAs** | **Quick biometric switch.** Audit trail captures every handoff. Matches retail ops reality where iPads change hands throughout a shift. |
| 5 | **Client-visible mode permission** | **All SA+ roles can use.** Trust the SA, audit the sessions. Client-visible mode is an SA tool, not a manager-gated feature. |
| 6 | **Photo consent retention** | **Per session.** Consent confirmed at the start of each session, never assumed from prior sessions. Safer under Law 25. |
| 7 | **Apple Pencil requirement** | **Optional accessory.** Recommended for stores doing custom designs regularly, not required for V1 rollout. |
| 8 | **iPad assignment model** | **Shared across SAs.** Each SA signs in with biometric auth. No device-to-person binding. Matches how retail actually operates. |
| 9 | **Offline session duration** | **Flag at 2 hours.** Non-blocking warning surfaces at 2 hours offline, prompts SA to find WiFi or complete session for sync. |
| 10 | **Client photo default visibility** | **Visible in client account.** With explicit consent captured at session start. Transparency is the point — "we remember what you tried." |

These resolutions are reflected in the relevant sections above. This table remains for change-history traceability.
