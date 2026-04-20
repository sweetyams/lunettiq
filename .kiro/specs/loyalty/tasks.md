# Implementation Plan: Lunettiq Loyalty Program Gaps

## Overview

The loyalty program core is already implemented: tier config, credits ledger API, membership API, UI components (MembershipCard, CreditsLedger, CreditAdjustModal), client profile integration, and all three Inngest cron jobs. This plan covers the 8 gaps identified in the design document — mostly hardening the Inngest jobs and adding a small UI improvement.

## Tasks

- [ ] 1. Fix monthly credit issuance (Inngest)
  - [ ] 1.1 Add membership status check to monthlyCredits
    - In `src/lib/inngest/functions.ts`, update the `monthlyCredits` function's member query to include `metafields` in the select
    - Filter out members where `metafields.custom.membership_status` is `paused` or `cancelled`
    - _Requirements: 6.2, 6.5_

  - [ ] 1.2 Add Shopify metafield sync to monthlyCredits
    - After inserting each ledger entry, call `updateCustomerMetafield(Number(m.id), 'custom', 'credits_balance', String(newBalance), 'number_decimal')`
    - Wrap in `.catch(() => {})` to avoid failing the entire batch on a single metafield error
    - _Requirements: 6.4_

  - [ ] 1.3 Add batching to monthlyCredits
    - Process members in batches of 10 with a 500ms delay between batches using `step.sleep()`
    - _Requirements: 6.6_

- [ ] 2. Fix birthday credit issuance (Inngest)
  - [ ] 2.1 Add idempotency check to birthdayCredits
    - Before issuing, query `credits_ledger` for an existing `issued_birthday` entry for this customer in the current year
    - Skip if one already exists
    - _Requirements: 7.5_

  - [ ] 2.2 Add Shopify metafield sync to birthdayCredits
    - After inserting the ledger entry, call `updateCustomerMetafield` to update `custom.credits_balance`
    - _Requirements: 7.4_

- [ ] 3. Fix nightly reconciliation (Inngest)
  - [ ] 3.1 Add Shopify metafield sync to creditReconciliation
    - After inserting the correction ledger entry, call `updateCustomerMetafield` with the ledger balance
    - _Requirements: 8.4_

- [ ] 4. Fix credits adjust API validation
  - [ ] 4.1 Reject zero-amount adjustments
    - In `src/app/api/crm/clients/[id]/credits/route.ts` POST handler, change validation to explicitly reject `Number(amount) === 0`
    - _Requirements: 2.7_

- [ ] 5. Add pagination to CreditsLedger UI
  - [ ] 5.1 Add "Load more" to CreditsLedger component
    - In `src/components/crm/CreditsLedger.tsx`, track `offset` state and add a "Load more" button that fetches the next page and appends entries
    - Hide the button when fewer results than `limit` are returned
    - _Requirements: 5.2_
