# Loyalty Program V2 — Design Document

**Date:** 2026-04-18  
**Status:** Draft  
**Spec:** [`specs/loyalty-v2.md`](../../specs/loyalty-v2.md)  
**Source:** [`data/lunettiq-loyalty-program-v2.md`](../../data/lunettiq-loyalty-program-v2.md)

---

## 1. Problem Statement

V1 loyalty is subscription-only — no acquisition funnel, no referral, and power-user credits erode margin. V2 adds a points base layer for acquisition, tier-weighted referral, a CULT trial conversion ramp, and rebalanced credit economics.

## 2. Architecture

```
┌──────────────────────────────────────────────────┐
│                  Storefront                       │
│  /pages/loyalty  /account/points  /account/referrals  /r/[code]  │
│  PDP dual-price  checkout points redemption       │
└──────────────┬───────────────────────┬───────────┘
               │                       │
┌──────────────▼──────┐  ┌─────────────▼───────────┐
│  Account APIs       │  │  CRM APIs               │
│  points, referrals  │  │  /crm/loyalty/*          │
│  trials, membership │  │  fraud queue, dashboards │
└──────────┬──────────┘  └──────────┬──────────────┘
           │                        │
           └────────┬───────────────┘
                    ▼
┌─────────────────────────────────────────────────┐
│              Postgres (Neon)                      │
│  credits_ledger (extended: currency, expires_at) │
│  referrals (new)                                 │
│  membership_trials (new)                         │
│  loyalty_tiers (extended: fees, perks)           │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              Inngest                             │
│  points_expiry  trial_conversion  fraud_review   │
│  milestone_check  vault_gift  purchase_points    │
└─────────────────────────────────────────────────┘
```

## 3. Key Design Decisions

### 3.1 One ledger, two currencies
Credits and points share `credits_ledger` with a `currency` column. Running balance is per-currency. This avoids a second table and keeps all financial history in one audit trail.

### 3.2 Points built in-house (not Smile.io/Yotpo)
The ledger already exists. Third-party engines don't know about membership tiers and create data portability problems. Build cost is low — it's earn rules + a redemption endpoint.

### 3.3 Referral built in-house (Phase 1)
A `referrals` table + URL handler. Fraud detection via Inngest hourly scan. Reconsider third-party (Friendbuy) only if fraud volume exceeds ops capacity.

### 3.4 Trial clawback is automated
Card-on-file charge at day 31. 50% of used credits invoiced on cancel. Manual override available for managers. Soft enforcement trains bad behavior.

### 3.5 Annual billing as default
UI shows annual price first, monthly as toggle. Annual members churn ~50% less. The math only works with annual as the nudge.

## 4. Schema Changes

### 4.1 `credits_ledger` — 3 new columns
- `currency` enum (`credit` | `points`) — **required migration**, backfill existing rows as `credit`
- `related_referral_id` uuid nullable
- `expires_at` timestamptz nullable (points only)

### 4.2 `referrals` — new table
Tracks referral lifecycle: click → signup → qualification → reward. Fraud signals stored as JSONB. Indexed on `referrer_customer_id`, `referrer_code`, `status`.

### 4.3 `membership_trials` — new table
One row per trial. Tracks credits issued, credits used, outcome, clawback amount. One trial per customer lifetime enforced by unique constraint on `shopify_customer_id` + check on `trial_used` metafield.

### 4.4 `loyalty_tiers` — extend
Add `annual_fee`, `monthly_fee`, `second_sight_rate`, `early_access_hours`, and boolean perk flags. All configurable from CRM settings.

## 5. Points Implementation

### 5.1 Earning
Inngest event handlers for each earn action. Order webhook triggers `points_issued_purchase` (1pt/$1 on net amount). Signup/consent webhooks trigger one-time bonuses. Birthday cron issues annual points.

### 5.2 Redemption
Checkout API accepts `pointsToRedeem`. Validates: min 200, max 25% of subtotal, not combinable with member pricing. Writes negative ledger entry. Shopify discount applied via draft order or cart attribute.

### 5.3 Expiry
Daily Inngest job scans for points with `expires_at` approaching. Sends Klaviyo warnings at 90/30/7 days. Separate job executes expiry (writes `points_expired` ledger entry). Members exempt while active.

## 6. Referral Implementation

### 6.1 Flow
1. Member/customer gets unique code (generated on first request, stored in `referrals.referrer_code`)
2. `/r/[code]` → sets cookie + redirects to homepage
3. On referred signup → creates `referrals` row with `status: pending`
4. On referred first order >$100 → Inngest qualifies referral, issues rewards per tier table
5. Hourly fraud scan flags suspicious patterns

### 6.2 Fraud Detection
Inngest `referral_fraud_review` checks: same billing address across referrals, same IP/device, disposable email domains, returns on qualifying orders. Flags for CRM ops queue — never auto-blocks.

## 7. Trial Implementation

### 7.1 Flow
1. Customer triggers trial (500+ pts or $250+ purchase, no previous trial)
2. Creates `membership_trials` row, issues $25 CULT credits, sets tier tag
3. Day 23 + day 28: Inngest sends reminder emails
4. Day 31: Inngest `trial_conversion_scan` — if not cancelled, converts to paid (charges card)
5. If cancelled before day 31: unused credits forfeited, used credits × 50% = clawback charge

### 7.2 PDP Integration
Non-member with points sees three prices: full, with-points, with-CULT. "Try CULT free" CTA links to trial start.

## 8. Phased Rollout

| Phase | Timeline | Scope |
|---|---|---|
| 1 | Site launch | Points earn/redeem, non-member referral (points only), revised tiers, dual-price PDP, new Second Sight rates |
| 2 | +4-6 weeks | CULT trial, tier-weighted referral, milestones, early access, Klaviyo flows |
| 3 | +3-6 months | VAULT events, archive vote, annual gift, CULT colourways, WhatsApp |
| 4 | Year 2+ | Travel events, factory visits, gift memberships, B2B |

## 9. Migration Plan

1. Add `currency` column to `credits_ledger` with default `'credit'`
2. Backfill all existing rows: `UPDATE credits_ledger SET currency = 'credit'`
3. Add `expires_at`, `related_referral_id` columns (nullable)
4. Create `referrals` and `membership_trials` tables
5. Extend `loyalty_tiers` with new columns
6. Deploy new Inngest functions
7. Enable points earning (Phase 1 launch)

## 10. Success Metrics

| Metric | Target |
|---|---|
| Trial → paid conversion | >50% |
| Tier mix (Essential/CULT/VAULT) | 30/60/10% |
| Monthly churn (CULT) | <8% |
| Monthly churn (VAULT) | <5% |
| Credit redemption rate | ~85% |
| Points redemption rate | 40-55% |
| Referral qualify rate | >20% |
| New members via referral | 30% at steady state |
| Payback period | <9 months blended |
