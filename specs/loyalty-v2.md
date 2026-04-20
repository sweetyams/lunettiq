# Loyalty Program V2 — Technical Specification

**Source:** `data/lunettiq-loyalty-program-v2.md`  
**Date:** 2026-04-18  
**Status:** Draft

---

## 1. System Overview

Four stacked layers, each solving a specific commercial problem:

```
VAULT  ($79/mo · $799/yr)  → Status, access, collector relationship
CULT   ($39/mo · $399/yr)  → Rotation, style habit, recurring revenue core
ESSENTIAL ($19/mo · $199/yr) → Coverage, first commitment, CULT feeder
LUNETTIQ POINTS (free)      → Acquisition, email capture, conversion ramp

REFERRAL flows across all four layers
SECOND SIGHT trade-in available at all layers (tier-weighted)
```

One unified ledger (`credits_ledger`) powers both credits and points with a `currency` column.

---

## 2. Points — The Base Layer

Free to join. Converts anonymous visitors into known customers, known customers into members.

### 2.1 Conversion Rate

100 points = $5 CAD. Fixed. No tier multipliers on points.

### 2.2 Earning Rules

| Action | Points | Frequency | Trigger |
|---|---|---|---|
| Email signup | 100 ($5) | Once | Klaviyo subscribe event |
| SMS opt-in | 100 ($5) | Once | Consent change webhook |
| Account creation | 200 ($10) | Once | Customer create webhook |
| First purchase completed | 500 ($25) | Once | Order webhook, `order_count == 1` |
| Every $1 spent | 1 pt | Ongoing | Order webhook, net of returns/points portion |
| Birthday | 200 ($10) | Annual | Inngest cron |
| Review with photo | 100 ($5) | Per product | Review webhook or manual |
| Referral qualifies | 2,500 ($125) | Unlimited | Referral qualification event |
| Second Sight C-grade donation | 100 ($5) | Per trade-in | Intake graded event |
| Survey/feedback | 50 ($2.50) | 2x/year max | Manual Inngest event |

**Not earnable on:** membership fees, points-redeemed portion of orders, gift cards.

### 2.3 Redemption

- Minimum: 200 pts ($10)
- Increments: $5 at checkout
- Max: 25% of order subtotal
- Cannot combine with member pricing on same item (can stack with non-member sale prices)
- Excluded: tax, shipping, gift cards, Second Sight trade-in credits

### 2.4 Points → Membership Conversion

| Points | Gets | Value |
|---|---|---|
| 4,000 | 1 month CULT free | $39 |
| 8,000 | 3 months Essential free | $57 |
| 20,000 | 1 year Essential free | $199 |
| 40,000 | 1 year CULT free | $399 |

Intentionally better value than product redemption — funnels toward membership.

### 2.5 Expiry

- 18 months after last earn OR redeem activity
- Warnings: 90 days, 30 days, 7 days via Klaviyo
- Members: points don't expire while membership active
- On cancel: points enter non-member expiry from grace period end
- Why 18 months: eyewear purchase cycle is 18-24 months

---

## 3. Referral Program

Two-sided. Tier-aware. Built on `referrals` table.

### 3.1 Qualification Criteria

- Referred customer completes first purchase >$100 CAD net
- Within 90 days of referral link click
- Email not previously on file

### 3.2 Rewards by Referrer Tier

| Referrer Tier | Referrer Gets | Referred Gets |
|---|---|---|
| Non-member | 2,500 pts ($125) | $25 off first order + auto-enrolled in points |
| Essential | $30 credit + 1mo extension | $25 off + 1mo Essential free |
| CULT | $50 credit + 1mo extension | $25 off + 1mo CULT free |
| VAULT | $75 credit + VAULT event invite | $40 off + 1mo CULT free (not VAULT — aspirational gap) |

### 3.3 Milestone Bonuses (annual reset)

| Qualified Referrals | Bonus |
|---|---|
| 3 | Tier upgrade for 3 months (or +$50 credit if VAULT) |
| 5 | Free custom engraving on next frame |
| 10 | VAULT event invite regardless of tier |

### 3.4 Mechanics

- Unique referral link per customer: `lunettiq.com/r/<code>`
- Shareable via IG story template, WhatsApp, email, SMS
- Referrer dashboard: pending, qualified, total rewards
- No cap (fraud thresholds apply)

### 3.5 Fraud Guards

Auto-flag, never auto-block. Ops reviews daily.
- Same billing address + IP + device fingerprint → held 30 days
- Disposable email domains → flagged
- Returns on qualifying orders → re-evaluate
- Rapid signup→qualify→redeem cycles → flagged

---

## 4. Membership Tiers (Revised)

Credits lower, perks heavier. Annual as default.

### 4.1 Essential — $19/mo · $199/yr

| Benefit | Value |
|---|---|
| Monthly credit | $12 ($144/yr) |
| Birthday credit | $25 |
| Second Sight rate | 15% |
| Shipping | Free standard |
| Repairs/adjustments | 1/yr free |
| Early access to sales | 24h before public |
| Member-only pricing | Accessories + lens upgrades |
| Priority CS queue | CRM-routed |

Margin at 85% redemption: ~38% gross on fee alone.

### 4.2 CULT — $39/mo · $399/yr

| Benefit | Value |
|---|---|
| Monthly credit | $25 ($300/yr) |
| Birthday credit | $25 |
| Second Sight rate | 30% |
| Shipping | Free priority (1-day target) |
| Frame rotation | 25% off 1/yr (with Second Sight return) |
| Early access to drops | 48h before public |
| Named optician | Assigned at home location |
| Priority booking | 48h ahead of public |
| Repairs/adjustments | Unlimited free |
| Style consultation | 30 min/yr (virtual or in-store) |
| CULT-only colourways | 1-2/yr |
| Member-only pricing | Accessories + lens upgrades |

Net contribution: ~$250-300/member/yr.

### 4.3 VAULT — $79/mo · $799/yr

| Benefit | Value |
|---|---|
| Monthly credit | $45 ($540/yr) |
| Birthday credit | $50 |
| Second Sight rate | 35% |
| Shipping | Free overnight |
| Frame rotation | Free swap 1/yr (equal or lesser MSRP) |
| Early access | 96h (48h before CULT) |
| All CULT perks | Included |
| Archive vote | 1 reissue vote/yr |
| Private WhatsApp | Direct line to named optician |
| Annual curated gift | Physical object (~$60 cost) |
| Brand events | 2-4/yr (Montreal + 1 travel) |
| Custom frame consultations | No rush-fee markup |

Net contribution: ~$300-400/member/yr. Low margin per member but highest referral + cultural value.

### 4.4 Full Comparison

| | Non-member | Essential | CULT | VAULT |
|---|---|---|---|---|
| Annual fee | $0 | $199 | $399 | $799 |
| Monthly credit | — | $12 | $25 | $45 |
| Birthday credit | $10 (pts) | $25 | $25 | $50 |
| Second Sight | 10% | 15% | 30% | 35% |
| Shipping | — | Standard | Priority | Overnight |
| Early access | — | 24h | 48h | 96h |
| Named optician | — | — | ✓ | ✓ |
| Repairs | Paid | 1/yr | Unlimited | Unlimited |
| Frame rotation | — | — | 25% off | Free |
| Style consult | — | — | 30min/yr | Unlimited |
| Events | — | — | — | 2-4/yr |
| Annual gift | — | — | — | ✓ |
| Archive vote | — | — | — | ✓ |
| WhatsApp line | — | — | — | ✓ |

### 4.5 30-Day CULT Trial

**Eligibility:** 500+ points OR purchase >$250, AND no previous trial.

**Flow:**
1. Card on file required
2. $25 CULT credits issued day 1, tier tag applied
3. Day 23 + day 28: reminder emails
4. Day 31: auto-convert to paid OR clawback
5. Cancel before day 31: unused credits forfeited, used credits invoiced at 50%
6. One trial per customer, lifetime

### 4.6 Pause / Cancel / Upgrade / Downgrade

**Pause** (CULT/VAULT only, 1x per 12mo, max 2 months):
- Credits stop, points continue, perks suspended, existing credits retained

**Cancel:**
- Charges stop immediately, 60-day grace to redeem credits
- After grace: credits expire, points enter non-member expiry
- Can rejoin anytime (credits gone, tier history preserved)

**Upgrade:** Immediate. Prorated fee difference. New credits next month.

**Downgrade:** Effective at next renewal only. Existing credits retained.


---

## 5. Second Sight (Updated)

### 5.1 Trade-In Rates

| Tier | Rate |
|---|---|
| Non-member | 10% (down from 20%) |
| Essential | 15% |
| CULT | 30% |
| VAULT | 35% |

Non-member dropped to 10% so Essential's 15% feels meaningful (50% lift).

### 5.2 Grade Multipliers

- Grade A: 50% of base rate
- Grade B: 35% of base rate
- Grade C: 5-10% (recycling credit) OR 100 Lunettiq Points if donated to charity

### 5.3 Example — Frame MSRP $325

| Tier | Grade A | Grade B | Grade C donation |
|---|---|---|---|
| Non-member | $16.25 | $11.38 | — |
| Essential | $24.38 | $17.06 | 100 pts ($5) |
| CULT | $48.75 | $34.13 | 100 pts ($5) |
| VAULT | $56.88 | $39.81 | 100 pts ($5) |

---

## 6. Data Model

### 6.1 `credits_ledger` — extend existing

New columns:

| Column | Type | Notes |
|---|---|---|
| `currency` | enum `credit \| points` | Required. Backfill existing as `credit` |
| `related_referral_id` | uuid, nullable | FK to `referrals.id` |
| `expires_at` | timestamptz, nullable | Points only |

New `transaction_type` values:
```
points_issued_signup, points_issued_purchase, points_issued_birthday,
points_issued_review, points_issued_referral_referrer,
points_issued_referral_referred, points_issued_milestone,
points_redeemed_order, points_redeemed_membership_conversion,
points_expired, membership_trial_started, membership_trial_converted,
membership_trial_cancelled, membership_trial_clawback, referral_qualified
```

Running balance maintained per currency.

### 6.2 `referrals` — new table

| Column | Type |
|---|---|
| `id` | uuid PK |
| `referrer_customer_id` | text, indexed |
| `referrer_code` | text, unique |
| `referred_customer_id` | text, nullable |
| `referred_email` | text, nullable |
| `status` | enum `pending \| qualified \| fraudulent \| expired` |
| `clicked_at` | timestamptz |
| `signed_up_at` | timestamptz, nullable |
| `qualified_at` | timestamptz, nullable |
| `qualifying_order_id` | text, nullable |
| `referrer_tier_at_qualification` | text, nullable |
| `referrer_reward_amount` | decimal, nullable |
| `referrer_reward_currency` | enum `credit \| points` |
| `fraud_signals` | jsonb |
| `created_at` | timestamptz |

### 6.3 `membership_trials` — new table

| Column | Type |
|---|---|
| `id` | uuid PK |
| `shopify_customer_id` | text, indexed |
| `tier` | text (`cult` only in V1) |
| `started_at` | timestamptz |
| `credits_issued_at_start` | decimal |
| `credits_used_during_trial` | decimal |
| `outcome` | enum `pending \| converted \| cancelled \| clawback_applied` |
| `converts_at` | timestamptz (day 31) |
| `cancelled_at` | timestamptz, nullable |
| `clawback_amount` | decimal, nullable (50% of used) |
| `created_at` | timestamptz |

### 6.4 `loyalty_tiers` — extend existing

New columns:

| Column | Type |
|---|---|
| `annual_fee` | decimal |
| `monthly_fee` | decimal |
| `second_sight_rate` | decimal |
| `early_access_hours` | integer |
| `named_optician` | boolean |
| `free_repairs` | text (null / "1/yr" / "unlimited") |
| `style_consultation` | text (null / "30 min/yr" / "unlimited") |
| `events_per_year` | integer |
| `annual_gift` | boolean |
| `archive_vote` | boolean |
| `private_whatsapp` | boolean |

### 6.5 Shopify Metafield Additions

```
custom.points_balance              number_decimal
custom.points_last_activity        date
custom.lifetime_referrals          number_integer
custom.qualified_referrals_ytd     number_integer (annual reset)
custom.trial_used                  boolean
custom.referral_code               single_line_text_field
custom.next_credit_expiry_warning  date
```

---

## 7. Inngest Jobs

| Job | Schedule | Purpose |
|---|---|---|
| `points_issued_purchase` | On order webhook | Award 1pt/$1 net spent |
| `points_expiry_scan` | Daily 3am | Flag points nearing 18mo, send 90/30/7-day warnings |
| `points_expiry_execute` | Daily 4am | Expire flagged points, write ledger |
| `trial_conversion_scan` | Hourly | Day 30+ trials → convert to paid or clawback |
| `trial_reminder` | Daily 9am | Day 23 + day 28 reminder emails |
| `referral_fraud_review` | Hourly | Flag suspicious referrals for ops queue |
| `milestone_check` | On referral qualify | Award milestone bonuses at 3/5/10 thresholds |
| `vault_gift_dispatch` | On member anniversary | Trigger VAULT gift fulfilment task |
| `referral_expiry` | Daily | Expire pending referrals past 90 days |


---

## 8. API Endpoints

### 8.1 Points (Customer)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/account/points` | Balance, history, expiry dates |
| `POST` | `/api/account/points/redeem` | Redeem at checkout |

### 8.2 Points (CRM)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/crm/clients/[id]/points` | Points balance + mini ledger |
| `POST` | `/api/crm/clients/[id]/points/adjust` | Manual adjustment (manager+) |

### 8.3 Referrals (Customer)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/account/referrals` | My code, stats, pending, milestones |
| `GET` | `/api/r/[code]` | Referral link → cookie + redirect |

### 8.4 Referrals (CRM)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/crm/referrals` | List + fraud queue |
| `PATCH` | `/api/crm/referrals/[id]` | Approve/reject flagged |

### 8.5 Trials (Customer)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/account/trial/start` | Start 30-day CULT trial |
| `POST` | `/api/account/trial/cancel` | Cancel trial (clawback applies) |

### 8.6 Trials (CRM)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/crm/trials` | Active trials list |
| `PATCH` | `/api/crm/trials/[id]` | Waive clawback (manager+) |

### 8.7 Membership (extends existing)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/account/membership/upgrade` | Self-service upgrade |
| `POST` | `/api/account/membership/pause` | Self-service pause |
| `POST` | `/api/account/membership/cancel` | Self-service cancel |

---

## 9. Storefront Pages

| Page | Auth | Purpose |
|---|---|---|
| `/pages/loyalty` | Public | Landing page: tiers, points, referral explained |
| `/account/loyalty` | Customer | Member dashboard: tier, credits, perks, history |
| `/account/points` | Customer | Points balance, earn history, expiry, redeem |
| `/account/referrals` | Customer | Referral link, pending/qualified, milestones |
| `/r/[code]` | Public | Referral landing → set cookie → redirect homepage |

### 9.1 PDP Dual-Price Display

For non-member with points:
```
Full price:          $245
With your 500 pts:   $220  (–$25)
─────────────────────
With CULT:           $208  (–$37)
     Try CULT free for 30 days →
```

CULT price always better than points redemption. That's the funnel.

### 9.2 Checkout Integration

- Points redemption widget: slider or input, shows dollar value
- Validates max 25% of subtotal, not combinable with member pricing
- Referral cookie detected → auto-apply referred discount

---

## 10. CRM Views

### 10.1 Client Profile (extends MembershipSection)

- Points balance with mini ledger
- Referral stats: code, lifetime count, YTD qualified, total earned
- Active trial status: days remaining, credits used, outcome

### 10.2 New CRM Pages

| Page | Purpose |
|---|---|
| `/crm/loyalty` | Dashboard: tier distribution, MRR, trial conversion rate, referral funnel |
| `/crm/loyalty/trials` | Active trials with days remaining + usage |
| `/crm/loyalty/referrals` | Referral list + fraud queue |
| `/crm/settings/loyalty` | Tier config: fees, credits, perks, Second Sight rates |

### 10.3 Loyalty Dashboard Metrics

- Active members by tier
- MRR
- Tier mix % (target: 30% Essential, 60% CULT, 10% VAULT)
- Monthly churn by tier
- Trial conversion rate
- Credit redemption rate
- Points redemption rate
- Referral qualify rate

---

## 11. Program Governance

### 11.1 Configurable Settings (CRM admin)

All editable from `/crm/settings/loyalty`, affect future transactions only:

- Tier fees (monthly + annual)
- Monthly/birthday credit per tier
- Referral rewards per tier pair
- Milestone thresholds + rewards
- Points earn rates per action
- Points expiry duration (default 18mo)
- Trial duration (default 30 days)
- Clawback % (default 50%)
- Second Sight rates by tier + grade
- VAULT gift budget

### 11.2 Staff Override Authority

| Action | Role |
|---|---|
| Manual points adjustment | Manager+ |
| Manual credit adjustment | Manager+ |
| Waive trial clawback | Manager+ |
| Force referral qualification | Manager+ |
| Comp tier upgrade (3mo free) | Owner only |
| Program-wide credit adjustment | Owner only, 2FA confirm |

All overrides require reason field. Audited.

### 11.3 Anti-Spam Rules

- Max 2 marketing emails/month per member (hard cap)
- SMS: transactional only unless marketing SMS opted in
- Renewal reminders: -30d, -7d, -1d only
- Post-expiry: single re-engagement at +14d, then silence

---

## 12. Phased Rollout

### Phase 1 — Foundation (site launch)
- Points earning + redemption
- Non-member referral (points only)
- Revised tier pricing + credits
- Dual-price PDP
- Second Sight new rates
- Account pages: points, membership
- Email consent → points

### Phase 2 — Activation (+4-6 weeks)
- 30-day CULT trial
- Tier-weighted referral rewards
- Milestone bonuses (3/5/10)
- Early access mechanic (48h product visibility)
- Klaviyo lifecycle flows

### Phase 3 — Signature (+3-6 months)
- First VAULT event (small, Montreal, ~20 attendees)
- Archive vote mechanic
- VAULT annual gift fulfilment
- CULT limited colourway drop
- VAULT WhatsApp line

### Phase 4 — Scale (year 2+)
- Travel event (NYC or Paris)
- Factory visit for top 20 VAULT
- Gift memberships
- Custom engraving reward (milestone 5)
- B2B/corporate memberships

---

## 13. Success Metrics

| Metric | Target |
|---|---|
| Trial → paid conversion | >50% |
| Tier mix (Essential/CULT/VAULT) | 30/60/10% |
| CULT monthly churn | <8% |
| VAULT monthly churn | <5% |
| Credit redemption rate | ~85% |
| Points redemption rate | 40-55% |
| Referral qualify rate | >20% |
| New members via referral | 30% steady state |
| Payback period | <9 months blended |
| VAULT NPS | 60+ |
| CULT repeat purchase rate | 1.8 frames/yr |
| Points breakage (unredeemed) | 45-60% |

### Counter-Metrics (watch for)
- Rising trial cancellation → trial is leaky
- Declining Essential credit redemption → disengagement, will churn
- Referral fraud signals increasing → program being gamed
- VAULT churn >5% → perks not hitting (belonging problem, not math)
