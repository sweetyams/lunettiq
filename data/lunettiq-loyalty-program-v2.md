# Lunettiq — Loyalty Program Specification v2

**Status:** Draft for review
**Supersedes:** `lunettiq-loyalty-program.md` (Oct 2022)
**Last updated:** April 2026
**Cross-references:** CRM spec §16 (Membership) · CRM spec §6.5 (credits_ledger) · Functionality spec §6.3 (dual pricing)

---

## Framing

The original program did one thing well: it invented a subscription-based relationship with eyewear. That's the durable insight. This version keeps that core and fixes three structural gaps.

**What changed:**
1. A points layer sits underneath membership for non-members and acquisition
2. Tier-weighted referral, built into both membership and points
3. CULT credits recalibrated so power users stay profitable
4. A 30-day CULT trial bridges points to membership
5. Non-monetary perks take the centre of each tier's value, not credits
6. One unified ledger (credits + points) powered by `credits_ledger`

**What stayed:**
- Three-tier structure: Essential / CULT / VAULT
- Second Sight trade-in program (tier-weighted)
- Subscription fees with credit-deposit model
- Pause/cancel/grace period mechanics

**Design principles (applied throughout):**
- Access over discount. Discounts cheapen; access elevates.
- Membership is identity. Points are transactional.
- Every tier needs at least one perk that costs Lunettiq attention, not margin.
- Acquisition ramp before retention engine. You can't retain what you can't acquire.
- Annual default. Monthly is the exception, not the other way around.

---

## Contents

1. [System overview](#1-system-overview)
2. [Points — the base layer](#2-points--the-base-layer)
3. [Referral program](#3-referral-program)
4. [Membership tiers (revised)](#4-membership-tiers-revised)
5. [The conversion ramp](#5-the-conversion-ramp-points--membership)
6. [Second Sight (updated)](#6-second-sight-updated)
7. [Unified ledger + technical integration](#7-unified-ledger--technical-integration)
8. [Member communication rhythm](#8-member-communication-rhythm)
9. [Program governance](#9-program-governance)
10. [Launch sequencing](#10-launch-sequencing)
11. [Success metrics](#11-success-metrics)
12. [Edge cases + policy](#12-edge-cases--policy)
13. [Open decisions](#13-open-decisions)

---

## 1. System overview

Four layers, stacked. Each layer solves a specific commercial problem.

```
┌─────────────────────────────────────────────────────────────┐
│  VAULT  ($79/mo · $799/yr)                                  │
│  → Status, access, collector relationship                   │
├─────────────────────────────────────────────────────────────┤
│  CULT  ($39/mo · $399/yr)                                   │
│  → Rotation, style habit, recurring revenue core            │
├─────────────────────────────────────────────────────────────┤
│  ESSENTIAL  ($19/mo · $199/yr)                              │
│  → Coverage, first commitment, CULT feeder                  │
├─────────────────────────────────────────────────────────────┤
│  LUNETTIQ POINTS  (free)                                    │
│  → Acquisition, email capture, conversion ramp              │
└─────────────────────────────────────────────────────────────┘

              REFERRAL flows across all four layers
              SECOND SIGHT trade-in available at all layers (tier-weighted rate)
```

**Logic of the stack:**
- Points capture everyone who doesn't buy yet. Cheap to run. No margin hit unless redeemed.
- Essential catches the committed buyer who won't commit to $39/mo. Feeds CULT.
- CULT is the revenue engine. Highest volume tier at steady state.
- VAULT is the brand's cultural ceiling. Small in count, disproportionate in signal.

The number that matters: % of repeat buyers in CULT or above. That's the retention proof.

---

## 2. Points — the base layer

Free to join. One purpose: turn anonymous visitors into known customers, and known customers into members.

### 2.1 Program mechanics

**Name:** Lunettiq Points (internal shorthand; marketing can reframe as "Lunettiq Rewards" if softer tone needed)

**Conversion:** 100 points = $5 CAD. Fixed rate. No tier-based bonus multipliers on points (keep it simple; membership is where the math gets better).

### 2.2 Earning

| Action | Points | Frequency |
|---|---|---|
| Email signup | 100 pts ($5) | Once per account |
| SMS opt-in | 100 pts ($5) | Once per account |
| Account creation | 200 pts ($10) | Once |
| First purchase completed | 500 pts ($25) | Once |
| Every dollar spent | 1 pt per $1 | Ongoing |
| Birthday | 200 pts ($10) | Annual |
| Review with photo | 100 pts ($5) | Once per product |
| Referral qualifies (see §3) | 2,500 pts ($125) | Unlimited |
| Second Sight C-grade donation | 100 pts ($5) | Per trade-in |
| Survey / feedback participation | 50 pts ($2.50) | 2x per year max |

**Engagement earn is intentionally low.** Reviews pay 100 pts, not 500. The goal is to keep point issuance tied to value creation, not activity theatre.

### 2.3 Redemption

- Minimum redemption: 200 pts ($10)
- Increments: $5 at checkout, up to 25% of order subtotal
- Cannot be combined with active member pricing on same item (but can stack with non-member sale prices)
- Excluded: tax, shipping, gift cards, Second Sight trade-in credits (those are their own thing)

**Conversion path to membership** (the important part):
- 4,000 pts → one month CULT free (value: $39)
- 8,000 pts → three months Essential free (value: $57)
- 20,000 pts → one year Essential free (value: $199)

Note the math. Converting points into membership gives better value than redeeming for product. That's intentional. Points funnel toward membership, not away from it.

### 2.4 Expiry

- Points expire 18 months after last earning OR redemption activity
- Warning email at 90 days before expiry
- Second warning at 30 days
- Members don't have point expiry while their membership is active (points pause with membership pause, expire on cancellation after grace)

**Why 18 months not 12:** Eyewear is bought every 18-24 months by non-members. Shorter expiry creates urgency that feels manipulative at this price point.

### 2.5 What points are NOT

- Not a substitute for membership pricing on PDP dual-display
- Not transferable between accounts
- Not redeemable for cash
- Not earnable on membership fees themselves (you don't earn points for earning points)
- Not earnable on points-redeemed portion of an order (no infinite loop)

---

## 3. Referral program

Two-sided. Tier-aware. Built on shared infrastructure (one referral engine, different rewards by referrer tier).

### 3.1 Qualification

A referral **qualifies** when:
- Referred customer completes first purchase over $100 CAD net (after points/discounts)
- Within 90 days of referral link click
- Customer is genuinely new (email not previously on file)

Fraud guard: same billing address + same IP + same device fingerprint → flagged, held 30 days, reviewable by ops.

### 3.2 Rewards by referrer tier

| Referrer tier | Referrer gets | Referred customer gets |
|---|---|---|
| Non-member (points only) | 2,500 pts ($125) | $25 off first order + auto-enrolled in points |
| Essential | $30 credit + 1 month membership extension | $25 off + 1 month Essential free on signup |
| CULT | $50 credit + 1 month membership extension | $25 off + 1 month CULT free on signup |
| VAULT | $75 credit + VAULT event invite | $40 off + 1 month CULT free on signup |

**Why tier-weight it:**
- Higher-tier members are higher-trust signals. Their social graph skews toward higher-LTV prospects.
- Gives members another reason to stay in their tier beyond personal benefit.
- The VAULT referred gets *CULT* free, not VAULT. The gap creates aspirational pull.

### 3.3 Mechanics

- Each member has a unique referral link: `lunettiq.com/r/<code>`
- Shareable via Instagram story template, WhatsApp, email, SMS
- Referrer dashboard shows pending + qualified + total rewards earned
- No cap on referrals (but fraud thresholds apply to abnormal velocity)

### 3.4 Milestone bonuses

Stack on top of per-referral rewards:

| Qualified referrals | Bonus |
|---|---|
| 3 | Upgrade one tier for 3 months (or +$50 credit if already VAULT) |
| 5 | Custom engraving on next frame (free, normally $40 add-on — V2) |
| 10 | Invited to a VAULT event regardless of current tier |

Milestones reset annually. Prevents one-time viral spikes from exhausting the mechanic.

### 3.5 Referral copy direction

Not "refer a friend, get $30." That's the Warby Parker language. Instead: "Share Lunettiq with someone whose taste you respect." The selection signal is the point.

---

## 4. Membership tiers (revised)

All three tiers get a reset. Credits are lower. Perks are heavier. The math now favours active members without over-rewarding power users.

### 4.1 Essential — "The Coverage Tier"
**$19/mo or $199/yr (annual saves 2 months)**

*Positioning:* For the buyer who wants a real relationship with the brand but isn't ready for the style-rotation commitment.

**What they pay for:**
- $12/month ($144/yr) in Lunettiq Credits *(down from $15 — protects margin, still meaningfully below fee)*
- Free shipping + returns on every order
- 15% trade-in rate through Second Sight *(down from 20% at non-member, giving Essential a real edge — see §6)*
- $25 birthday credit
- One free tune-up/adjustment per year
- Access to member-only pricing on accessories and lens upgrades

**Non-monetary perks:**
- Priority customer service queue (tagged in CRM, routed first)
- Early access to sales (24 hours before public)

**Margin protection:**
- At 85% credit redemption: $122 delivered value vs $199 fee paid = 38% gross margin on fee alone, before product margin on redemptions
- Credits skewed low on purpose. This tier is a commitment mechanic, not a value-generation mechanic.

### 4.2 CULT — "The Style Rotation Tier"
**$39/mo or $399/yr (annual saves 2 months)**

*Positioning:* For the person who thinks of eyewear as rotation, not replacement. This is where the program's economic centre of gravity sits.

**What they pay for:**
- $25/month ($300/yr) in Lunettiq Credits *(down from $30)*
- Free shipping + returns, priority handling (1-day fulfilment target)
- 30% trade-in rate through Second Sight
- $25 birthday credit
- 25% off one additional frame per year when returning one through Second Sight
- Early access to new drops (48 hours before public)
- Member-only pricing on accessories and lens upgrades

**Non-monetary perks (the real CULT value):**
- Named optician assigned at home location; they text you when your Rx is approaching renewal, when a frame in your stated preferences arrives
- Priority appointment booking (48 hrs ahead of public availability)
- Unlimited free lens cleaning, minor repairs, and adjustments at any location
- Annual 30-minute style consultation with a stylist (virtual or in-store)
- Access to CULT-only limited edition colourways (typically 1-2 per year)

**Margin math at 85% redemption:**
- Credits redeemed: $255 (on ~$425 of product = product margin ~60% × $425 = $255 gross margin)
- Fee paid: $399
- Free shipping cost: ~$40/yr
- Lens refresh folded in (see below)
- Net contribution: ~$250-300 per member per year before acquisition cost

**The $40 Lens Refresh is folded in.** Instead of a separate mechanic, CULT credits are usable on lens upgrades at member pricing. Simpler. Same net value.

### 4.3 VAULT — "The Collector's Tier"
**$79/mo or $799/yr (annual saves 2 months)**

*Positioning:* For the person who wants the brand as a cultural identifier. Status. Access. Recognition. The person who'd rather own three Lunettiq frames than one Gucci.

**What they pay for:**
- $45/month ($540/yr) in Lunettiq Credits *(down from $60)*
- 35% trade-in rate through Second Sight
- One Free Frame Rotation per year (swap one frame for another of equal or lesser MSRP, pay member-only lens pricing)
- $50 birthday credit
- Free shipping, free overnight on any order

**Non-monetary perks (this is why VAULT exists):**
- All CULT perks included
- First look at collaborations (48 hrs ahead of CULT, 96 hrs ahead of public)
- Vote on one archive reissue per year (genuine: the winning vote gets reissued)
- Private WhatsApp line to their named optician
- Annual curated gift — something physical, not a credit. A book on eyewear history. A leather frame case. A small object that signals care. Cost: ~$60 per member per year. Worth every cent for the retention it generates.
- Named invites to 2-4 brand events per year (Montreal base + one travel event in NY or Paris for scale)
- Private consultations for custom frame design (with manufacturing run at full cost, no rush-fee markup)
- Behind-the-curtain: factory visit in Italy (self-funded travel, hosted tour; for true collectors — V2+)

**Margin math at 85% redemption:**
- Credits redeemed: $459 (on ~$765 of product = ~$459 gross margin)
- Fee paid: $799
- Annual gift cost: $60
- Events cost amortized: ~$40-80/member/yr
- Free shipping/overnight: ~$80/yr
- Net contribution: ~$300-400 per member per year

VAULT is deliberately low margin per member — but VAULT members refer more, post more, spend more on top of credits, and give the brand cultural shape. They're an acquisition engine, not a profit centre.

### 4.4 Tier comparison table

| Benefit | Non-member | Essential | CULT | VAULT |
|---|---|---|---|---|
| Annual fee | $0 | $199 | $399 | $799 |
| Monthly credit | 0 | $12 | $25 | $45 |
| Annual credit total | 0 | $144 | $300 | $540 |
| Birthday credit | $10 (via points) | $25 | $25 | $50 |
| Second Sight rate | 10% | 15% | 30% | 35% |
| Free shipping | — | Standard | Priority | Overnight |
| Early access to drops | — | 24h | 48h | 96h |
| Named optician | — | — | ✓ | ✓ |
| Repairs/adjustments | Paid | 1/yr free | Unlimited | Unlimited |
| Frame rotation | — | — | 25% off | Free (1/yr) |
| Style consultation | — | — | 30 min/yr | Unlimited |
| Private events | — | — | — | 2-4/yr |
| Collab access | Public drop | 24h early | 48h early | 96h early |
| Annual gift | — | — | — | ✓ |
| Archive vote | — | — | — | ✓ |
| Private WhatsApp line | — | — | — | ✓ |

### 4.5 Annual as default

Signup flow defaults to annual with monthly as toggle. Annual price shown first. Monthly shown as "$XX/mo (billed monthly)" to emphasize the comparison.

**Why:** Annual members churn ~50% less than monthly at this price point. Annual gives the brand a full year of credit-earning runway before the customer can cancel without forfeit. The math only works if the default nudge is toward annual.

---

## 5. The conversion ramp (points → membership)

The gap between "$0 — have 500 points" and "$399/yr for CULT" is the biggest friction in the whole system. This is how it bridges.

### 5.1 The 30-day CULT trial

Available when:
- Customer has accumulated 500+ points (shown proof of engagement)
- OR is completing a purchase over $250 (shown proof of purchase intent)
- AND has no previous CULT membership

**Terms:**
- First 30 days of CULT free
- First month's credits ($25) issued on day 1
- Credit card on file, billed on day 31 unless cancelled
- If cancelled before day 31: credits issued are clawed back (or unused credits forfeited; used credits invoiced at 50% — i.e., if you used $20 of credits and cancel, you owe $10)
- One trial per customer, lifetime

**Why the soft clawback:** Pure "free month" is abusable. Full clawback is unfriendly. The 50%-on-used formula makes honest trials free and bad-faith trials a wash.

### 5.2 The upgrade moment on PDP

When a non-member points-earner is browsing a frame, the PDP shows:

```
Full price:          $245
With your 500 pts:   $220  (–$25)
─────────────────────
With CULT:           $208  (–$37)
     Try CULT free for 30 days →
```

The CULT price is always better than the points redemption. That's the funnel.

### 5.3 The "you've already earned it" nudge

After 3+ purchases as a non-member, email trigger:
> "You've spent $XXX with us over the last year. As a CULT member, you'd have saved $YY and earned $ZZ in credits on those orders. Your next purchase is on us — start your 30-day CULT trial."

Shows the counterfactual. Makes the case with their own data.

### 5.4 Points → membership conversion

Direct conversion:
- 4,000 pts → 1 month CULT
- 8,000 pts → 3 months Essential
- 20,000 pts → 1 year Essential
- 40,000 pts → 1 year CULT *(hard to reach, and intentionally so)*

These exist mostly for optics. Most members will convert via trial, not via points-conversion. But the option being there makes the whole ecosystem feel coherent.

---

## 6. Second Sight (updated)

Unchanged in structure. Rate table recalibrated to make Essential meaningful.

### 6.1 Trade-in rate by tier

| Tier | Rate |
|---|---|
| Non-member | 10% *(down from 20% — protects Essential's value)* |
| Essential | 15% |
| CULT | 30% |
| VAULT | 35% |

**Why drop non-member rate to 10%:** The original 20% non-member rate made Essential's 20% feel redundant. At 10% non-member / 15% Essential, the lift into Essential is real (50% better trade-in value). At 30% CULT, the jump is dramatic.

### 6.2 Grade multipliers (unchanged)

- Grade A: 50% of base rate
- Grade B: 35% of base rate
- Grade C: 5-10% of base rate (recycling credit) OR 100 Lunettiq Points if donated

**New addition:** C-grade trade-ins can opt to donate the frame to a vision charity (Lunettiq partners with one — see Jimmy Fairly's RestoringVision model for benchmark). Donating earns 100 Lunettiq Points in addition to or instead of the recycling credit. Turns a low-margin transaction into a brand-positive story.

### 6.3 Example calculations

Frame MSRP: $325

| Tier | Grade A credit | Grade B credit | Grade C donation bonus |
|---|---|---|---|
| Non-member | $16.25 | $11.38 | $0 (no donation) |
| Essential | $24.38 | $17.06 | 100 pts ($5) |
| CULT | $48.75 | $34.13 | 100 pts ($5) |
| VAULT | $56.88 | $39.81 | 100 pts ($5) |

Transparent calculator lives on the storefront Second Sight page. No surprises at pickup.

---

## 7. Unified ledger + technical integration

### 7.1 One ledger, two currencies

The existing `credits_ledger` table in the CRM spec handles this with minor additions.

**Schema additions:**

```
credits_ledger (extended)
  id                 uuid
  shopify_customer_id string
  currency           enum ('credit' | 'points')        ← NEW
  transaction_type   enum (existing + new types below)
  amount             decimal (positive issuance / negative redemption)
  running_balance    decimal (by currency)
  reason             text
  related_order_id   string
  related_intake_id  uuid
  related_referral_id uuid                              ← NEW
  staff_id           string
  location_id        string
  occurred_at        timestamp
  expires_at         timestamp                          ← NEW (points only)
  created_at         timestamp
```

**New transaction_type values:**
```
Points-specific:
- points_issued_signup
- points_issued_purchase
- points_issued_birthday
- points_issued_review
- points_issued_referral_referrer
- points_issued_referral_referred
- points_issued_milestone
- points_redeemed_order
- points_redeemed_membership_conversion
- points_expired

Membership-specific:
- membership_trial_started
- membership_trial_converted
- membership_trial_cancelled
- membership_trial_clawback

Referral-specific:
- referral_qualified (linked to points_issued_referral_* or credit_issued_referral)
```

Running balance maintained separately per currency. Queries filter on `currency` column.

### 7.2 New table: referrals

```
referrals
  id                   uuid PK
  referrer_customer_id string (indexed)
  referrer_code        text (unique)
  referred_customer_id string (nullable until qualified)
  referred_email       text (nullable, captured at signup)
  status               enum ('pending' | 'qualified' | 'fraudulent' | 'expired')
  clicked_at           timestamp
  signed_up_at         timestamp
  qualified_at         timestamp
  qualifying_order_id  string
  referrer_tier_at_qualification  text
  referrer_reward_amount decimal
  referrer_reward_currency enum ('credit' | 'points')
  fraud_signals        jsonb
  created_at           timestamp
```

Indexed by referrer_customer_id, referrer_code, status.

### 7.3 New table: membership_trials

```
membership_trials
  id                   uuid PK
  shopify_customer_id  string (indexed)
  tier                 text ('cult' — V1 only trial available)
  started_at           timestamp
  credits_issued_at_start decimal
  credits_used_during_trial decimal
  outcome              enum ('pending' | 'converted' | 'cancelled' | 'clawback_applied')
  converts_at          timestamp
  cancelled_at         timestamp (nullable)
  clawback_amount      decimal (nullable)
  created_at           timestamp
```

### 7.4 Shopify metafield additions

Already covered in CRM spec §5.5 for tier/credits/member_since etc. Adding:

```
custom.points_balance              number_decimal
custom.points_last_activity        date
custom.lifetime_referrals          number_integer
custom.qualified_referrals_ytd     number_integer  (resets yearly)
custom.trial_used                  boolean (one trial per lifetime)
custom.next_credit_expiry_warning  date (for point expiry email triggers)
```

### 7.5 Inngest jobs

New scheduled jobs added to `src/lib/inngest/functions.ts`:

| Job | Schedule | Purpose |
|---|---|---|
| points_expiry_scan | Daily 3am EST | Flag points approaching 18-month expiry, send warning emails |
| points_expiry_execute | Daily 4am EST | Expire points past threshold, write ledger entry |
| trial_conversion_scan | Hourly | Find trials at day 30, convert to paid or apply clawback |
| trial_reminder | Daily 9am EST | Day 23 + day 28 reminder emails to trial users |
| referral_fraud_review | Hourly | Flag pending referrals with multiple fraud signals for ops review |
| milestone_check | Real-time on qualify | Award milestone bonuses when referral counts cross thresholds |
| annual_vault_gift_dispatch | Annual (member anniversary) | Trigger fulfilment task for VAULT gift |

Existing monthly credit issuance job extends: now also handles trial->paid conversions and applies different credit amounts by tier per revised §4.

### 7.6 Storefront visibility

Customer-facing, on storefront account page:

- **My Points** panel: balance, recent activity, expiry warning, "earn more" suggestions
- **My Membership** panel: tier, credits, perks unlocked, next renewal, referral link
- **My Second Sight** panel: trade-in history + total earned
- **My Referrals** panel: pending/qualified counts, referral link, milestone progress

All four powered by reads from Postgres projection (`customers_projection` + `credits_ledger` + `referrals`).

### 7.7 CRM admin visibility

Existing `MembershipCard` component (spec 04) extends to show:

- Points balance (with mini ledger)
- Referral stats (referrer count, total earned via referrals)
- Active trial status (if any, with days remaining and current usage)

New admin views at `/crm/loyalty`:
- Dashboard: tier distribution, MRR, trial conversion rate, referral funnel
- Points ledger explorer (filterable)
- Referral fraud queue
- Active trials list (for customer service outreach day 25-28)

---

## 8. Member communication rhythm

A luxury program dies faster from over-communication than under. The rhythm matters.

### 8.1 Per-member lifecycle touches

**Points-only customer:**
- Welcome email with point balance
- Monthly "your points summary" (volume: low)
- 90/30/7-day expiry warnings
- Upgrade nudge at 3+ purchases

**Essential member:**
- Monthly credit deposit confirmation
- Birthday email + credit issued
- Renewal reminder at 30 days + 7 days
- Tier-exclusive drops (as they happen, max 1/month)

**CULT member:**
- All Essential touches, plus:
- Quarterly "from your optician" — personal note from named optician
- Invite to annual style consultation (once per year)
- Limited colourway announcements (as they happen, max 2/year)

**VAULT member:**
- All CULT touches, plus:
- Anniversary gift dispatch notification
- 4-6 event invites per year (some they attend, some they decline)
- Archive vote (annual)
- Hand-signed card from Benjamin annually *(scales while it scales — rewrite when it doesn't)*

### 8.2 Anti-spam rules

- No more than 2 marketing emails per month to any member tier (hard cap, overrides any automation)
- SMS: only transactional unless customer opts into marketing SMS specifically
- Renewal reminders: 1 email at -30 days, 1 at -7 days, 1 at -1 day. Never more.
- Expired? Single re-engagement email at day +14 after expiry. Silence after.

### 8.3 Campaign segments (Klaviyo-ready)

Built from existing segmentation engine (CRM spec §13). Key new segments:

- Points-earners with 3+ purchases, not member (trial target)
- Essential members with 2+ full-price purchases in 6 months (CULT upgrade target)
- CULT members with no orders in 9 months (at-risk segment)
- VAULT members active in last 30 days (engaged, prioritize for events)
- Members with pending referrals (status update communication)
- Non-members with points expiring in 30 days (re-engagement)

---

## 9. Program governance

What the business configures, what the code assumes.

### 9.1 Editable configuration (admin UI, per CRM admin spec §5.1)

- Tier fees (monthly + annual) per tier
- Monthly credit amount per tier
- Birthday credit per tier
- Referral reward per referrer tier + referred tier
- Milestone thresholds (3, 5, 10 referrals) + rewards
- Points earn rates (per $, per action)
- Points expiry duration (18 months default)
- Trial duration (30 days default)
- Clawback percentage (50% default)
- Second Sight rates by tier and grade
- Annual gift budget per VAULT member

Changing these affects future transactions only. Historical ledger entries are immutable — that's the audit guarantee.

### 9.2 Staff override authority

| Action | Role required |
|---|---|
| Manual points adjustment | Manager or higher |
| Manual credit adjustment | Manager or higher (already in spec) |
| Waive trial clawback | Manager or higher |
| Force referral qualification (manual override) | Manager or higher |
| Create comp tier upgrade (3 months free) | Owner only |
| Program-wide credit adjustment (all members) | Owner only, two-factor confirm |

All overrides require a reason field. Audited.

### 9.3 Fraud patterns to watch

Program integrity requires active monitoring. Inngest jobs + CRM dashboard surface:

- Multiple accounts same address (referral farming)
- Rapid signup → qualify → redeem cycles (funnel abuse)
- Disposable email domains on referred accounts
- Returns on qualifying orders (fake qualifications)
- Points-redemption immediately followed by return
- Trial signups with throwaway payment methods

Auto-flag, don't auto-block. Ops reviews daily.

### 9.4 Legal

- Points have no cash value. Disclosed in terms.
- Credits have no cash value outside Lunettiq. Disclosed.
- Membership fees non-refundable except in 14-day cooling-off (Quebec consumer protection) from first subscription date only.
- Cancellation at any time honoured. Grace period credits redeemable.
- All consent captured per Law 25 (CRM spec §10.3).

---

## 10. Launch sequencing

Don't launch everything at once. Staging matters.

### 10.1 Phase 1 — Foundation (with V1 site launch)

- Points system: earning + redemption live
- Referral (non-member only, 2,500 pts reward)
- All three membership tiers at revised pricing
- Dual-price display on PDP
- Second Sight at new tier rates
- Storefront account page with points/membership panels
- Email consent captures points

**What's NOT yet live:**
- Trial
- Tier-weighted referral (referral only pays points in Phase 1)
- Annual gift dispatch
- Events program
- Milestone bonuses

### 10.2 Phase 2 — Activation (4-6 weeks post-launch)

Once you have a few hundred points-earners in the database:

- 30-day CULT trial enabled
- Tier-weighted referral rewards
- Milestone bonuses (3/5/10)
- Member-only early access mechanic (48hr-early product visibility)
- Klaviyo flows for all the lifecycle communications

### 10.3 Phase 3 — Signature (3-6 months post-launch)

- First VAULT event (small, invitation-only, Montreal, ~20 attendees)
- Archive vote mechanic
- Annual VAULT gift fulfilment (as members hit first anniversary)
- CULT limited colourway drop
- WhatsApp line for VAULT (requires ops capacity)

### 10.4 Phase 4 — Scale (year 2+)

- Second travel event (NYC or Paris)
- Factory visit program for top 20 VAULT
- Points-based conversion paths fully enabled
- Referral-based custom engraving reward (milestone 5)

---

## 11. Success metrics

Measure what matters. Ignore the rest.

### 11.1 Headline metrics (weekly dashboard)

- Active members by tier (Essential / CULT / VAULT)
- MRR
- Tier mix % (target steady state: 30% Essential, 60% CULT, 10% VAULT)
- Monthly churn rate by tier (target: <8% for CULT, <5% for VAULT)
- Trial conversion rate (target: >50%)

### 11.2 Program health

- Credit redemption rate (tracking toward 85% — anything higher = pricing problem)
- Points redemption rate (target: 40-55% — higher = points too generous)
- Referral qualify rate (target: >20% of signups qualify)
- % of new members acquired via referral (target: 30% at steady state)
- Average time from points signup to membership (shorter = ramp working)

### 11.3 Customer health

- NPS by tier (VAULT should be 60+)
- Repeat purchase rate within tier (CULT target: 1.8 frames/year)
- % of VAULT attending at least 1 event/year (target: 60%)
- Named-optician engagement rate (CULT target: 40% of members interact with their optician outside of scheduled appointments)

### 11.4 Financial

- Contribution margin per member per tier
- Payback period on member acquisition (target: <9 months blended)
- Credit liability on books (watch this — it's a real number at scale)
- Unredeemed points breakage (expected 45-60%, contributes to margin)

### 11.5 Counter-metrics (watch for)

- Rising trial cancellation rate (trial is leaky)
- Declining credit redemption on Essential (members aren't engaging, will churn)
- Referral fraud signals increasing (program getting gamed)
- VAULT churn above 5% (perks aren't hitting — this tier is about belonging, not math)

---

## 12. Edge cases + policy

### 12.1 Pause and cancel

**Pause** (CULT and VAULT only, one 2-month pause per 12 months):
- Credit issuance stops
- Points earning continues (customer is still shopping, just not subscribed)
- Perks suspended (no early access, no named optician queue)
- Credits accumulated before pause retained
- Auto-resumes after 2 months or customer action

**Cancel:**
- Immediate end of subscription charges
- 60-day grace period to redeem existing credits
- After grace: credits expire, points enter non-member expiry schedule
- Tier tags removed after grace
- Member can rejoin at any time — previous credits gone, but tier history preserved for narrative ("welcome back")

### 12.2 Downgrade / upgrade mid-period

**Upgrade** (Essential → CULT, CULT → VAULT):
- Effective immediately
- New credit tier applies next month
- Fee difference prorated against remaining period

**Downgrade:**
- Effective at next renewal only (prevents gaming higher tier then downgrading)
- Existing credits retained at old tier value

### 12.3 Refunds on credit-purchased items

- If customer returns a product bought partly with credits: credits refunded back to balance, cash portion refunded to card
- Credits do not expire if they came back from a return, even past original expiry date (returns essentially reset the clock)

### 12.4 Gift memberships (V2)

- One customer buys CULT or VAULT for another
- Gift recipient gets the full tier benefits for the gifted period
- Referrer gets milestone credit for the referral (counts as a qualified referral)
- Recipient is not auto-enrolled in points (they're a member, different relationship)

### 12.5 B2B / corporate memberships (V3)

Potential future mechanic: companies gift CULT to employees as perks. Out of V1/V2 scope but don't foreclose in the data model.

### 12.6 Deceased / unresponsive accounts

- No auto-charge past 90 days of silence if card fails
- Accounts with no activity for 3 years flagged for archival
- Points/credits on archived accounts: notified via last known email, 30-day claim window, then forfeit

### 12.7 Tier badge visibility

- On PDP dual-price display: always show CULT price (it's the aspirational tier)
- On customer profile: show actual tier
- In-store: SA tablet displays tier badge on client lookup (CRM spec already supports this)

---

## 13. Open decisions

Decisions needed before build. Each has concrete downstream impact.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **Subscription billing provider** | A: Shopify Subscriptions (native). B: Recharge (mature, pauses/upgrades strong). C: Bold. | **B** — Recharge. The tier-change mechanics (upgrade immediate, downgrade deferred, 2-month pause) are Recharge-native and painful to build on Shopify Subscriptions. Worth the ~$300/mo cost. |
| 2 | **Points engine — build or buy** | A: Build on credits_ledger. B: Smile.io. C: Yotpo Loyalty. | **A** — Build it. The ledger is already planned. Third-party points engines add complexity, bad data portability, and don't know about the membership side. |
| 3 | **Referral engine — build or buy** | A: Build. B: Friendbuy. C: Mention Me. | **A** for Phase 1 — it's a table (`referrals`) and a URL handler. **B** reconsidered at scale if fraud gets heavy. |
| 4 | **Annual gift sourcing** | A: Curate internally (Benjamin). B: Partner with Montreal artisans. C: Brand-produced item. | **B** for years 1-2. Positions Lunettiq in Montreal cultural ecosystem, stays on brand, scales okay with 50-200 VAULT members. Reconsider at 500+. |
| 5 | **Named optician scaling** | A: Every CULT member gets named optician. B: Only VAULT. C: CULT+ gets "home location" relationship, not named person. | **A** — commit to it. The brand promise of "optical credibility" demands this. Staffing plans around it. |
| 6 | **Trial clawback enforcement** | A: Automated, card-on-file chargebacks. B: Manual, ops handles day 31. C: Soft — no clawback, just terms. | **A** with manual override for edge cases. Enforcement that's too soft trains bad behaviour. |
| 7 | **VAULT event scale** | A: 1 big event/yr (50+ attendees). B: 4 small events/yr (15-20 each). | **B** — small, curated, feels like a dinner party not a product launch. Aligns with luxury benchmarks. |
| 8 | **Archive vote mechanic** | A: Single winner, guaranteed reissue. B: Top 3 voted, Benjamin picks one. C: Non-binding, just for signal. | **A** — make the promise real. This perk works because VAULT believes it's real. |
| 9 | **Points issuance on membership fees** | A: Points earned on membership fee ($199 → 199 pts). B: No points on fees. | **B** — keeps math clean, prevents funnel abuse where fees themselves generate redemption value. |
| 10 | **Cross-tier referral pairing** | A: All tiers can refer anyone. B: VAULT referral specifically converts to CULT not VAULT (aspirational gap). | **B** for referred reward — referred customer gets CULT free, not VAULT, regardless of referrer tier above Essential. Keeps VAULT scarce. |

---

## Summary: what's new vs original program

The original program was a subscription with credits. This one is:

- An acquisition funnel (points) that feeds a commitment funnel (trial) that feeds a retention engine (membership)
- Tier-weighted referral across all four layers
- Access-heavy tier perks, credit-light economics
- A conversion ramp engineered into the PDP itself
- A ledger architecture that unifies credits, points, and referrals
- Phased rollout matched to V1 site launch and beyond

It keeps the one thing worth keeping: a subscription-based relationship with eyewear. It fixes the three things that were quietly broken: no acquisition, no referral, and power-user margin erosion.

The program is now the commercial system, not just a retention mechanic.

---

*Cross-reference: CRM spec `lunettiq-crm-spec.md` · Competitor analysis `lunettiq-competitor-analysis.md` · Functionality spec `lunettiq-functionality-spec.md` · Brand guidelines `lunettiq-brand-guidelines.md`*
