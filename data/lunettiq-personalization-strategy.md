# Lunettiq — Personalization Strategy for Logged-In Users

**Status:** Draft for review
**Last updated:** April 2026
**Cross-references:** `lunettiq-loyalty-program-v2.md` · `lunettiq-crm-spec.md` · `lunettiq-functionality-spec.md` · `05-product-recs.md`

---

## Framing

The trap with personalization is treating it as a feature backlog: add a recommended grid, add a dynamic banner, add a greeting. That produces noise. For Lunettiq, personalization has to read as *the brand knowing you*, not *the site tracking you*. Access, not discount. Memory, not surveillance.

The data is already being captured. The job is deciding which signals earn screen real estate, where, and at what intensity.

**Design principles:**
- Personalization should reduce noise, not add to it
- Restraint on the homepage, density on the account page
- Tier-weighted intensity — not all signals should fire for all members
- The member should feel the site fits them before noticing why
- "Recommended by your optician" beats any algorithm output

---

## Contents

1. [The three signals you can already act on](#1-the-three-signals-you-can-already-act-on)
2. [Surface-by-surface plays](#2-surface-by-surface-plays)
3. [Tier-weighted intensity](#3-tier-weighted-intensity)
4. [The three-pass principle](#4-the-three-pass-principle)
5. [Sequencing](#5-sequencing)
6. [What not to build](#6-what-not-to-build)

---

## 1. The three signals you can already act on

Pulled straight from the loyalty and CRM specs. Eight distinct signal types. The question is how many get used per surface without turning the site into a dashboard.

### 1.1 Identity + tier
- Tag: `member-essential` / `member-cult` / `member-vault`
- Credits balance
- Days until renewal
- Member since
- Named optician (CULT+)
- Home location

### 1.2 Fit + Rx
- Face shape
- Frame width, bridge width, temple length (mm)
- Rx on file
- Rx last updated (expiry warning)
- Last lens refresh

### 1.3 Preferences (stated + derived)
- Shapes, materials, colours, price range, lens types
- "Avoid" list (stated only)
- Brands admired
- Purchase history
- Return rate

### 1.4 Loyalty mechanics
- Points balance + expiry date
- Referral milestone progress (3 / 5 / 10)
- Trial eligibility
- Second Sight history
- Frame rotation entitlement (VAULT)
- Archive vote status (VAULT)

---

## 2. Surface-by-surface plays

### 2.1 Homepage — calm, one-signal

The homepage should change, but quietly. One personal signal, woven into editorial. Not a "Welcome back, Willem, here are 12 things for you" overload.

**Changes to spec §4:**

- **Section b (Category entry).** For members with 2+ orders, one of the two category panels becomes derived-preference led ("More like what you wear") instead of the default category. Uses derived shape + material to build the collection link.
- **Section e (Second product row).** Becomes four curated: two from derived preferences, two from new arrivals in the member's price band. Replaces the static `homepage-featured` collection for logged-in members.
- **New: Contextual nudge band.** A single thin band above the footer (never above the fold). Rotated by priority:

| Priority | Trigger | Copy |
|---|---|---|
| 1 | VAULT archive vote open | "Vote on this year's reissue" |
| 2 | Rx expiring in 60 days | "Your prescription is due for an update" |
| 3 | Credits expiring in 30 days | "You have $XX in credits, used by [date]" |
| 4 | Referral milestone within 1 | "One more referral for a tier upgrade" |
| 5 | None of the above | Band hidden |

**Rule: one personal moment on the homepage. Never two.** Editorial brands lose atmosphere when they turn into notification centres.

---

### 2.2 PLP — filter by memory

The PLP is where derived preferences earn their keep.

**Changes to spec §5:**

- **"For you" sort option.** Added to the sort dropdown. Default sort for logged-in members with 2+ orders. Uses the existing suggestions scoring algorithm (spec 05) — surfaces across the grid rather than in a sidebar.
- **Persistent fit filter.** Auto-applies the member's size tag (`size:small` / `size:large`) based on their fit profile. Visible as a dismissible pill at the top of the grid. The visibility matters — don't hide the filter, name why the grid is filtered.
  - Pill copy: "Showing small frames based on your fit profile · Show all"
- **Soft exclusion.** Products on the `avoid` list (stated preference) drop to the bottom of the grid, not removed. A client who said "no metal" still sees metal frames, just later. Removal feels manipulative; demotion feels considered.
- **On Faces intelligence.** For logged-in members with a recorded face shape, bias the face-matched images to appear first when the On Faces toggle is active. Same feature, sharper hit rate.

---

### 2.3 PDP — the dual-price moment is the anchor

The dual-pricing display is already the core loyalty mechanic on the PDP. Build around it, don't stack next to it.

**Changes to spec §6:**

- **Member price, shown once.** Not repeated on cart, checkout, emails. Repeating member pricing across every surface is the discount-brand trap.
- **Fit confidence line.** When a member's face shape and frame width are on file, show a small line near the colour selector:
  - "Good fit for your measurements" (width within 2mm of `frame_width_mm`)
  - "Runs wider than your usual" (>3mm wider)
  - "Runs narrower than your usual" (>3mm narrower)
  - Silent when data is missing. Silent matters — half-information feels worse than no information.
- **Rx readiness.**
  - Rx on file and unexpired → lens selector pre-selects "Clear" + the member's Rx type (when V2 configurator ships)
  - Rx expiring in 90 days → inline note: "Rx on file expires [date]." No modal, no friction.
- **Credits applied preview.** Where the Sezzle line currently sits, add one row: "Apply $XX credit at checkout." Not a button. A statement. The work is already done.
- **"Recommended by your optician" flag.** When a product has been recommended via the CRM (spec 05 `product_recommendation` interaction), it carries a subtle marker on the PDP: "Recommended for you by [optician name] on [date]." This is the strongest personal signal in the system because it's human, not algorithmic. Own it.

---

### 2.4 Account page — the quiet hub

Homepage is restraint. Account is density.

The four panels from the loyalty spec (Points, Membership, Second Sight, Referrals) stay as the core. Add:

- **"Known about you"** — the transparency play. A collapsed panel showing:
  - Stated preferences (editable)
  - Derived preferences (read-only, with tooltip: "Based on 4 purchases")
  - Fit profile
  - Rx status + expiry
  - The point: "We remember what you told us." This is the differentiator against CHIMI and Jimmy Fairly, who can't do this.
- **Your optician's shelf** (CULT+ only). Three to six frames hand-picked by the named optician, with a short note. Not an algorithm output. A CRM interaction, surfaced on the web. This is where the "named optician" investment pays off on the website, not just in-store.
- **Lens refresh card.** If `last_lens_refresh` is more than 18 months ago: "Your lenses are due for a refresh. Book a 15-minute swap at [home_location]." Single action. Books against the appointments system (CRM spec §6.3).
- **Trade-in radar.** Uses purchase history + tier rate: "Your Draper frames were bought 14 months ago. Ready for Second Sight?" Preemptive, not promotional.

---

### 2.5 Search — weight by memory

Predictive search (V1) and Algolia (V2) both benefit from simple personalization:

- Boost results matching derived shapes and materials
- Demote results on the `avoid` list
- If a member types a category they've never bought from ("sunglasses" for an optical-only member), show their usual category first, then the searched category. Surface the crossover, don't hide it.

---

### 2.6 Emails and on-site nudges — rhythm matters

The loyalty spec has the anti-spam rules right (2 marketing emails/month, hard cap). Personalization should reduce email volume, not increase it.

- A member with a pending Rx expiry, credits expiring, and a new collab drop gets **one email** that bundles these with priority — not three.
- Klaviyo flows triggered by segment membership should suppress if the member has an active session on-site and will see the nudge there instead. Requires the PostHog V2 implicit-preference tracking. Worth naming now so the architecture supports it later.

---

## 3. Tier-weighted intensity

Not all personalization should fire at the same level across tiers. This is where "access over discount" becomes a design principle, not a slogan.

| Signal type | Non-member | Essential | CULT | VAULT |
|---|---|---|---|---|
| Derived preference sorting | ✓ | ✓ | ✓ | ✓ |
| Fit filter auto-apply | — | ✓ | ✓ | ✓ |
| Credits preview on PDP | — | ✓ | ✓ | ✓ |
| "Recommended by your optician" | — | — | ✓ | ✓ |
| Early access timestamps on PDP ("Live for you 48h early") | — | — | ✓ | ✓ |
| VAULT-only archive access gates | — | — | — | ✓ |
| Archive vote callout | — | — | — | ✓ |
| Annual gift status card on account | — | — | — | ✓ |
| Rx reminder | ✓ | ✓ | ✓ | ✓ |
| Lens refresh reminder | — | ✓ | ✓ | ✓ |
| Named optician's shelf | — | — | ✓ | ✓ |

**VAULT exclusivity principle:** VAULT members should see things other tiers literally can't. A VAULT member browsing the archives should see one reissuable frame marked "Vote this for the next reissue" while lower tiers see it as out-of-stock. This is a product moment, not a pricing moment.

---

## 4. The three-pass principle

From the loyalty program thinking: loyalty touchpoints should be woven in subtly, not foregrounded. Same rule applies to personalization.

**First pass.** The member should feel the site is set up for them without noticing why. Auto-applied fit filter, derived sort order, correct Rx type pre-selected.

**Second pass.** They start to notice the small signals. "How did it know I wear acetate?" "Why is this colour gone when I load the page?" These should feel like an oversight in their favour, not a feature.

**Third pass.** They come back a month later and the system remembers. Credits balance, expiring Rx, optician's note. This is where the "known by the brand" feeling lands.

Front-loading everything at the first pass breaks the atmosphere. Most DTC brands fail here because they want the credit for personalization immediately. The luxury positioning requires restraint.

---

## 5. Sequencing

V1 is the guest-friendly site. Personalization belongs in V2 when accounts ship.

### 5.1 V2.0 — with accounts launch

1. Account page personalization panels (all four core + "Known about you")
2. PDP: credits preview, Rx-on-file note, fit confidence line
3. PLP: "For you" sort + auto-applied fit filter
4. Homepage: contextual nudge band (one signal, rotated)

### 5.2 V2.1 — 4–8 weeks post V2.0

5. "Recommended by your optician" surfacing from CRM interactions
6. Search weighting by derived preferences
7. Lens refresh + trade-in radar cards on account
8. Tier-gated PDP visibility (early access timestamps, VAULT archive access)

### 5.3 V2.2 — when PostHog behavioural tracking is in place

9. Implicit preference signals (viewed-not-purchased, wishlist, comparison)
10. Email suppression when user is active on-site
11. Cross-surface nudge coordination (one message, best surface wins)

### 5.4 Explicitly deferred

- AI-generated personalized copy per member (feels hollow at this brand's register)
- Personalized homepage hero imagery (breaks the editorial voice)
- Dynamic pricing beyond the existing tier structure
- Behavioural retargeting ads keyed to browse sessions (against the loyalty-first principle)

---

## 6. What not to build

Don't build a "Hi Willem" bar across the top of the site. It's the DTC tell. Every brand with a half-baked account system does it.

The tier badge on the account page is enough. The rest should feel like the site simply fits better when you're signed in, not that it's performing familiarity at you.

---

## Starting point recommendation

If one play gets prototyped first as a proof point: **"Recommended by your optician."**

It threads the CRM (product recommendation interactions, spec 05), the loyalty investment (named optician as a CULT+ perk), and the web experience in one move. It demonstrates the "human over algorithm" positioning. And it's feasible — the data model already exists.

Everything else in this document scales from that principle: the site knows you because someone at Lunettiq knows you.
