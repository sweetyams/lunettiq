# Spec 04: VIP Loyalty System

**Status:** APPROVED
**Dependencies:** None (credits_ledger table already exists in schema)
**Permissions used:** org:membership:read, org:membership:update_tier, org:membership:update_status, org:credits:read, org:credits:adjust

---

## What exists today

### DB schema
- `credits_ledger` — already defined with transaction_type enum (issued_membership, issued_birthday, issued_manual, issued_second_sight, redeemed_order, expired, adjustment), amount, running_balance, reason, related IDs, staff/location, timestamps
- `customers_projection` — has tags (tier stored as member-essential/member-cult/member-vault), metafields (membership_status, credits_balance, member_since, next_renewal, etc.)

### Shopify metafields (defined in CRM spec §5.5)
- `custom.membership_status` — active/paused/cancelled
- `custom.credits_balance` — running total
- `custom.member_since` — date
- `custom.next_renewal` — date
- `custom.last_rotation_used` — date
- `custom.last_lens_refresh` — date

### Loyalty tiers (from loyalty program spec)
- Essential: $19/mo, $15/mo credits, 20% trade-in, $20 birthday credit
- CULT: $39/mo, $30/mo credits, 30% trade-in, $40 lens refresh, 25% frame rotation
- VAULT: $79/mo, $60/mo credits, 35-40% trade-in, $40 lens refresh, free frame rotation

### What doesn't exist yet
- No membership UI on client profile
- No credits ledger view
- No credit adjustment flow
- No tier change flow
- No Inngest jobs for automated credit issuance
- No reconciliation

---

## What to build

### 1. Credits ledger API

**File:** `src/app/api/crm/clients/[id]/credits/route.ts`

```
GET /api/crm/clients/[id]/credits
Auth: org:credits:read
Query: ?limit=50&offset=0
Returns: ledger entries for this client, ordered by occurredAt desc

POST /api/crm/clients/[id]/credits/adjust
Auth: org:credits:adjust
Body: { amount, reason }
```

Adjust logic:
1. Get current balance (SUM of ledger or latest running_balance)
2. Insert ledger entry: type=adjustment, amount, running_balance=old+amount
3. Update Shopify metafield credits_balance
4. Audit log

### 2. Membership API

**File:** `src/app/api/crm/clients/[id]/membership/route.ts`

```
GET /api/crm/clients/[id]/membership
Auth: org:membership:read
Returns: { tier, status, creditBalance, memberSince, nextRenewal, lastRotation, lastLensRefresh }

PATCH /api/crm/clients/[id]/membership
Auth: org:membership:update_tier (for tier changes) or org:membership:update_status (for status changes)
Body: { tier?, status? }
```

Tier change logic:
1. Remove old tier tag, add new tier tag on Shopify customer
2. Update projection tags
3. Audit log with before/after

Status change logic (pause/cancel/reactivate):
1. Update Shopify metafield custom.membership_status
2. If cancel: start 60-day grace period (set metafield custom.cancel_grace_ends)
3. If pause: set metafield custom.paused_at
4. If reactivate: clear pause/cancel metafields
5. Audit log

### 3. MembershipCard component

**File:** `src/components/crm/MembershipCard.tsx`

Pure presentational. Shows:
- Tier badge (Essential=neutral, CULT=blue, VAULT=gold/amber)
- Credits balance (large number)
- Member since date
- Next renewal date
- Status (active/paused/cancelled) with color
- Lens refresh: "Available" or "Used [date]" (CULT/VAULT only)
- Frame rotation: eligibility text (CULT/VAULT only)

### 4. CreditsLedger component

**File:** `src/components/crm/CreditsLedger.tsx`

Fetches from GET /api/crm/clients/[id]/credits. Shows:
- Table: date, type (human-readable), amount (+green/-red), balance, reason
- "Adjust" button → opens CreditAdjustModal

### 5. CreditAdjustModal component

**File:** `src/components/crm/CreditAdjustModal.tsx`

Modal with:
- Amount input (positive=credit, negative=debit)
- Reason textarea (required)
- Current balance shown
- Preview new balance
- Confirm button

### 6. Add to ClientProfileClient

In the right column, add MembershipCard + CreditsLedger sections.
Parse tier from client tags, parse metafields for membership data.

### 7. Inngest jobs for automated credits

Add to `src/lib/inngest/functions.ts`:

**Monthly credit issuance** (cron: 1st of month at 6AM)
- Query active members by tier tag
- For each: insert credits_ledger (issued_membership), update Shopify metafield

**Birthday credit** (cron: daily at 7AM)
- Query members where custom.birthday = today
- Issue $20 credit (Essential), scaled for higher tiers

**Nightly reconciliation** (cron: 2AM)
- For each member: SUM(credits_ledger.amount) vs Shopify metafield credits_balance
- If drift > $0.01 and < $5: auto-correct with adjustment entry
- If drift >= $5: log warning, don't auto-correct

---

## Tier config (constants, not DB)

**File:** `src/lib/crm/loyalty-config.ts`

```ts
export const TIERS = {
  essential: { tag: 'member-essential', label: 'Essential', monthlyCredit: 15, birthdayCredit: 20, tradeInRate: 0.20, lensRefresh: false, frameRotation: null },
  cult:      { tag: 'member-cult',      label: 'CULT',      monthlyCredit: 30, birthdayCredit: 20, tradeInRate: 0.30, lensRefresh: true,  frameRotation: '25% off' },
  vault:     { tag: 'member-vault',     label: 'VAULT',     monthlyCredit: 60, birthdayCredit: 20, tradeInRate: 0.375, lensRefresh: true, frameRotation: 'Free swap' },
} as const;
```

---

## Done criteria

- [ ] Credits ledger API (GET entries, POST adjust)
- [ ] Membership API (GET status, PATCH tier/status)
- [ ] MembershipCard on client profile with tier badge, balance, dates, perks
- [ ] CreditsLedger table on client profile
- [ ] CreditAdjustModal with amount + reason + preview
- [ ] Tier change updates Shopify tags + audit log
- [ ] Status change (pause/cancel/reactivate) updates metafields + audit log
- [ ] Monthly credit issuance Inngest job
- [ ] Birthday credit Inngest job
- [ ] Nightly reconciliation Inngest job
- [ ] TypeScript compiles clean

---

## Out of scope
- Subscription billing integration (Shopify Subscriptions / Recharge — V2)
- Frame rotation tracking workflow (V2)
- Lens refresh redemption workflow (V2)
- Second Sight credit calculation (already in second-sight module)
- Customer-facing membership page on storefront (separate spec)
