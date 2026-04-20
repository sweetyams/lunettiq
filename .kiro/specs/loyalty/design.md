# Design Document

## Overview

CRM-side management of the Lunettiq Loyalty Program: tier configuration, credit issuance/redemption, membership lifecycle (pause/cancel/reactivate), and automated background jobs. Shopify remains the source of truth for customer data; the CRM owns the credits ledger and exposes membership management through API routes and UI components on the client profile.

## What Exists Today

### Tier Configuration (Req 1 — IMPLEMENTED)

`src/lib/crm/loyalty-config.ts` exports:
- `TIERS` constant with `essential`, `cult`, `vault` configs (tag, label, monthlyCredit, birthdayCredit, tradeInRate, lensRefresh, frameRotation)
- `TierKey` type
- `getTierFromTags(tags)` — resolves tier from Shopify customer tags
- `getTierConfig(tier)` — returns config for a tier key

### Credits Ledger API (Req 2 — IMPLEMENTED)

`src/app/api/crm/clients/[id]/credits/route.ts`:
- `GET` — returns ledger entries ordered by `occurredAt` desc, paginated (limit/offset), requires `org:credits:read`
- `POST` — inserts adjustment entry, computes new running balance, updates Shopify `custom.credits_balance` metafield, writes audit log, requires `org:credits:adjust`

### Membership Status API (Req 3 — IMPLEMENTED)

`src/app/api/crm/clients/[id]/membership/route.ts`:
- `GET` — returns tier, tierLabel, status, creditBalance, memberSince, nextRenewal, lastRotation, lastLensRefresh
- `PATCH` — handles tier changes (tag swap + audit) and status changes (metafield update + grace period for cancel + audit)

### MembershipCard UI (Req 4 — IMPLEMENTED)

`src/components/crm/MembershipCard.tsx`:
- Tier badge with color coding (Essential=neutral, CULT=blue, VAULT=amber)
- Credit balance as prominent number
- Status with color indicator
- Member since / next renewal dates
- Lens refresh and frame rotation status for CULT/VAULT
- Returns "Not a member" text when no tier

### CreditsLedger UI (Req 5 — IMPLEMENTED)

`src/components/crm/CreditsLedger.tsx`:
- Fetches from `GET /api/crm/clients/[id]/credits?limit=20`
- Shows transaction type (human-readable), amount (green/red), reason, date
- "Adjust" button triggers `onAdjust` callback

### CreditAdjustModal (Req 5 — IMPLEMENTED)

`src/components/crm/CreditAdjustModal.tsx`:
- Amount input (positive=credit, negative=debit)
- Required reason textarea
- Shows current balance and preview of new balance
- Calls POST credits API on confirm

### Client Profile Integration (Req 9 — IMPLEMENTED)

`src/app/crm/clients/[id]/ClientCanvas.tsx`:
- Imports `MembershipCard`, `CreditsLedger`, `CreditAdjustModal`
- Parses tier from `getTierFromTags(client.tags)`
- Reads membership metafields from `client.metafields.custom`
- Credit balance computed server-side via SUM on credits_ledger

`src/app/crm/clients/[id]/page.tsx`:
- Fetches credit balance in parallel with other client data
- Passes stats including `creditBalance` to ClientCanvas

### Inngest Jobs (Reqs 6, 7, 8 — IMPLEMENTED)

`src/lib/inngest/functions.ts`:
- `monthlyCredits` — cron `0 6 1 * *`, iterates tiers, queries members by tag, inserts `issued_membership` ledger entries
- `birthdayCredits` — cron `0 7 * * *`, queries members by birthday metafield matching today's MM-DD, inserts `issued_birthday` entries
- `creditReconciliation` — cron `0 2 * * *`, compares ledger SUM vs Shopify metafield, auto-corrects drift < $5, flags drift >= $5

### DB Schema (Pre-existing)

`credits_ledger` table with: id, shopifyCustomerId, transactionType (enum), amount, runningBalance, reason, relatedOrderId, relatedIntakeId, staffId, locationId, occurredAt, createdAt. Indexed on shopifyCustomerId.

## Gaps and Improvements Needed

### Gap 1: Monthly credits doesn't check membership status (Req 6, AC 5)

The current `monthlyCredits` function queries members by tier tag only. It does not check `custom.membership_status` — paused members still receive credits.

**Fix:** Add a filter after fetching members to skip those where `metafields.custom.membership_status` is `paused` or `cancelled`.

```typescript
// In monthlyCredits, after fetching members:
const activeMembers = members.filter(m => {
  const status = ((m.metafields as any)?.custom?.membership_status) ?? 'active';
  return status === 'active';
});
```

Requires adding `metafields` to the select query.

### Gap 2: Monthly credits doesn't update Shopify metafield (Req 6, AC 4)

The current function inserts ledger entries but does not call `updateCustomerMetafield` to sync `custom.credits_balance` to Shopify.

**Fix:** After inserting the ledger entry, call:
```typescript
await updateCustomerMetafield(Number(m.id), 'custom', 'credits_balance', String(newBalance), 'number_decimal').catch(() => {});
```

### Gap 3: Birthday credits doesn't update Shopify metafield (Req 7, AC 4)

Same issue as Gap 2.

### Gap 4: Birthday credits lacks idempotency check (Req 7, AC 5)

No check for whether a birthday credit was already issued this year. Running the job twice on the same day would double-issue.

**Fix:** Before issuing, query:
```typescript
const existing = await db.select({ id: creditsLedger.id }).from(creditsLedger)
  .where(and(
    eq(creditsLedger.shopifyCustomerId, m.id),
    eq(creditsLedger.transactionType, 'issued_birthday'),
    sql`extract(year from ${creditsLedger.occurredAt}) = ${today.getFullYear()}`
  )).limit(1);
if (existing.length) continue;
```

### Gap 5: Monthly credits doesn't batch Shopify API calls (Req 6, AC 6)

Currently processes all members sequentially with no rate limiting. For large member counts, this could hit Shopify's API rate limits.

**Fix:** Process in batches of 10 with a 500ms delay between batches using `step.sleep()`.

### Gap 6: Reconciliation doesn't update Shopify metafield (Req 8, AC 4)

The reconciliation function inserts a correction ledger entry but doesn't actually update the Shopify metafield to match the ledger balance.

**Fix:** After inserting the correction entry, call `updateCustomerMetafield` with the ledger balance.

### Gap 7: Credits adjust API doesn't reject zero amount (Req 2, AC 7)

The POST handler checks `!amount` which is falsy for `0`, but the requirement explicitly states zero amounts should be rejected. The current check works but should be explicit.

**Fix:** Change to `if (Number(amount) === 0 || !reason)`.

### Gap 8: CreditsLedger UI lacks pagination (Req 5, AC 2)

Currently loads 20 entries with no "load more" mechanism.

**Fix:** Add a "Load more" button that fetches the next page via `offset` parameter.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/inngest/functions.ts` | Fix monthlyCredits (status check, Shopify sync, batching), birthdayCredits (Shopify sync, idempotency), reconciliation (Shopify sync) |
| `src/app/api/crm/clients/[id]/credits/route.ts` | Explicit zero-amount rejection |
| `src/components/crm/CreditsLedger.tsx` | Add "Load more" pagination |

## Files to Create

None — all files already exist.

## Dependency on Existing Patterns

- Inngest functions follow the existing pattern in `functions.ts`: `inngest.createFunction` with id, retries, cron trigger
- API routes use `handler()` wrapper from `route-handler.ts`, `requireCrmAuth()` for permissions, `jsonOk`/`jsonError` for responses
- Shopify metafield updates use `updateCustomerMetafield()` from `shopify-admin.ts`
- Audit logging uses `auditLog` table insert with action, entityType, entityId, staffId, diff
- UI components use CRM CSS variables (`--crm-*`) and `crm-btn`/`crm-input` class names
