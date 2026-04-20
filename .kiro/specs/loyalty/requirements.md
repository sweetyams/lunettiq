# Requirements Document

## Introduction

The Lunettiq Loyalty Program replaces transactional eyewear shopping with an ongoing membership relationship. Members pay a monthly fee and earn Lunettiq Credits they can stack and redeem on frames, lenses, accessories, and services. Three tiers (Essential, CULT, VAULT) offer escalating perks including trade-in bonuses via Second Sight, annual lens refresh credits, and frame rotation privileges. This spec covers the CRM-side management of memberships, credit issuance/redemption, tier lifecycle, and the automated background jobs that keep the system running.

## Glossary

- **Membership**: A customer's active subscription to one of the three loyalty tiers
- **Lunettiq_Credits**: Store currency earned monthly through membership, redeemable on any product or service
- **Credits_Ledger**: The append-only transaction log tracking every credit issuance, redemption, expiry, and adjustment
- **Tier**: One of Essential, CULT, or VAULT — determines monthly credit amount and available perks
- **Lens_Refresh**: A $40 annual credit for lens replacement or upgrades, available to CULT and VAULT members
- **Frame_Rotation**: An annual perk allowing members to trade in a frame for a discount (CULT: 25% off) or free swap (VAULT: equal/lesser MSRP)
- **Second_Sight**: The existing circular trade-in program; loyalty tier determines trade-in value percentage
- **Pause**: A temporary membership hold (up to 2 months per 12-month cycle) where credits stop accruing but existing credits are preserved
- **Grace_Period**: The 60-day window after cancellation during which remaining credits can still be redeemed
- **Reconciliation**: A nightly job that compares the credits_ledger running balance against the Shopify metafield and corrects drift
- **MembershipCard**: The CRM UI component displaying a member's tier, balance, status, and perk eligibility at a glance
- **Staff**: A Clerk-authenticated CRM user with a role (owner, manager, sa, readonly)

## Requirements

### Requirement 1: Tier Configuration

**User Story:** As a CRM developer, I want loyalty tier rules defined as a typed constant, so that tier logic is centralized and easy to update without schema changes.

#### Acceptance Criteria

1. THE App SHALL define a `TIERS` constant in `src/lib/crm/loyalty-config.ts` containing configuration for `essential`, `cult`, and `vault` tiers
2. EACH tier entry SHALL include: Shopify tag, display label, monthly credit amount, birthday credit amount, Second Sight trade-in rate, lens refresh eligibility (boolean), and frame rotation description (string or null)
3. THE App SHALL export a `getTierByTag(tag: string)` helper that returns the tier config for a given Shopify customer tag, or `null` if no tier matches
4. THE App SHALL export TypeScript types for `TierKey` and `TierConfig` so that consuming code has compile-time safety

### Requirement 2: Credits Ledger API

**User Story:** As a CRM staff member, I want to view a customer's full credit history and manually adjust their balance, so that I can resolve billing issues and apply courtesy credits.

#### Acceptance Criteria

1. WHEN a staff member requests a customer's credit history, THE App SHALL return ledger entries ordered by `occurredAt` descending with pagination (limit/offset)
2. THE API SHALL require the `org:credits:read` permission to view ledger entries
3. WHEN a staff member submits a credit adjustment, THE App SHALL insert a new ledger entry with type `adjustment`, compute the new running balance, and return the updated entry
4. THE API SHALL require the `org:credits:adjust` permission to submit adjustments
5. WHEN a credit adjustment is submitted, THE App SHALL update the customer's `custom.credits_balance` Shopify metafield to match the new running balance
6. WHEN a credit adjustment is submitted, THE App SHALL create an audit log entry recording the staff member, amount, reason, and before/after balance
7. THE adjustment endpoint SHALL reject requests where `reason` is empty or `amount` is zero

### Requirement 3: Membership Status API

**User Story:** As a CRM staff member, I want to view and manage a customer's membership tier and status, so that I can handle upgrades, downgrades, pauses, and cancellations.

#### Acceptance Criteria

1. WHEN a staff member requests membership info, THE App SHALL return the customer's current tier, status, credit balance, member-since date, next renewal date, last lens refresh date, and last frame rotation date
2. THE API SHALL require the `org:membership:read` permission to view membership info
3. WHEN a staff member changes a customer's tier, THE App SHALL remove the old tier tag and add the new tier tag on the Shopify customer, update the local projection, and create an audit log entry
4. THE API SHALL require the `org:membership:update_tier` permission for tier changes
5. WHEN a staff member pauses a membership, THE App SHALL set `custom.membership_status` to `paused` and record `custom.paused_at` on the Shopify customer
6. WHEN a staff member cancels a membership, THE App SHALL set `custom.membership_status` to `cancelled` and set `custom.cancel_grace_ends` to 60 days from now
7. WHEN a staff member reactivates a membership, THE App SHALL set `custom.membership_status` to `active` and clear the `paused_at` and `cancel_grace_ends` metafields
8. THE API SHALL require the `org:membership:update_status` permission for status changes
9. EACH status change SHALL create an audit log entry with the before/after status

### Requirement 4: Membership Card UI

**User Story:** As a CRM staff member viewing a client profile, I want to see the customer's membership status, credit balance, and perk eligibility at a glance, so that I can provide informed service.

#### Acceptance Criteria

1. THE MembershipCard SHALL display the customer's tier with a color-coded badge (Essential=neutral, CULT=blue, VAULT=amber)
2. THE MembershipCard SHALL display the current credit balance as a prominent number
3. THE MembershipCard SHALL display the membership status (active/paused/cancelled) with a color indicator (active=green, paused=yellow, cancelled=red)
4. THE MembershipCard SHALL display the member-since date and next renewal date
5. FOR CULT and VAULT members, THE MembershipCard SHALL show lens refresh status: "Available" or "Used [date]"
6. FOR CULT and VAULT members, THE MembershipCard SHALL show frame rotation eligibility text
7. IF the customer has no membership, THE MembershipCard SHALL not render

### Requirement 5: Credits Ledger UI

**User Story:** As a CRM staff member, I want to browse a customer's credit transaction history and make adjustments from the client profile, so that I can audit and correct balances without leaving the page.

#### Acceptance Criteria

1. THE CreditsLedger component SHALL display a table of transactions with columns: date, type (human-readable label), amount (green for positive, red for negative), running balance, and reason
2. THE CreditsLedger component SHALL load transactions with pagination (initial 20, load more on scroll or button)
3. THE CreditsLedger component SHALL include an "Adjust" button that opens the CreditAdjustModal
4. THE CreditAdjustModal SHALL show the current balance, an amount input (positive=credit, negative=debit), a required reason field, and a preview of the new balance
5. WHEN the adjustment is confirmed, THE CreditAdjustModal SHALL call the credits adjust API and refresh the ledger on success
6. THE "Adjust" button SHALL only be visible to staff with `org:credits:adjust` permission

### Requirement 6: Automated Monthly Credit Issuance

**User Story:** As a loyalty program operator, I want credits to be deposited automatically on the 1st of each month, so that members receive their benefits without manual intervention.

#### Acceptance Criteria

1. THE App SHALL run an Inngest cron function on the 1st of each month at 6:00 AM ET
2. THE function SHALL query all customers with an active membership status (not paused, not cancelled)
3. FOR each active member, THE function SHALL insert a `credits_ledger` entry with type `issued_membership` and the amount matching their tier's monthly credit
4. FOR each active member, THE function SHALL update the `custom.credits_balance` Shopify metafield to reflect the new balance
5. IF a member's status is `paused`, THE function SHALL skip credit issuance for that member
6. THE function SHALL process members in batches to avoid Shopify API rate limits

### Requirement 7: Automated Birthday Credit

**User Story:** As a loyalty program operator, I want members to automatically receive a birthday credit, so that the program feels personal without requiring staff action.

#### Acceptance Criteria

1. THE App SHALL run an Inngest cron function daily at 7:00 AM ET
2. THE function SHALL query active members whose birthday (from Shopify customer metafield `custom.birthday`) matches today's date
3. FOR each matching member, THE function SHALL insert a `credits_ledger` entry with type `issued_birthday` and the amount from their tier's birthday credit config ($20)
4. FOR each matching member, THE function SHALL update the `custom.credits_balance` Shopify metafield
5. THE function SHALL not issue a birthday credit if one has already been issued for the current year (idempotency check)

### Requirement 8: Nightly Balance Reconciliation

**User Story:** As a loyalty program operator, I want the system to detect and correct balance drift between the ledger and Shopify, so that customers always see an accurate credit balance.

#### Acceptance Criteria

1. THE App SHALL run an Inngest cron function nightly at 2:00 AM ET
2. THE function SHALL compute the expected balance for each active member by summing all `credits_ledger` entries
3. THE function SHALL compare the computed balance against the `custom.credits_balance` Shopify metafield
4. IF the drift is greater than $0.01 and less than $5.00, THE function SHALL auto-correct by inserting an `adjustment` ledger entry and updating the Shopify metafield
5. IF the drift is $5.00 or greater, THE function SHALL log a warning and NOT auto-correct
6. THE function SHALL process members in batches to avoid Shopify API rate limits

### Requirement 9: Client Profile Integration

**User Story:** As a CRM staff member, I want membership and credit information integrated into the existing client profile page, so that I don't need to navigate to a separate screen.

#### Acceptance Criteria

1. THE client profile page SHALL display the MembershipCard in the right column above existing sections
2. THE client profile page SHALL display the CreditsLedger below the MembershipCard
3. THE client profile page SHALL parse the customer's tier from their Shopify tags (e.g., `member-cult`)
4. THE client profile page SHALL parse membership metafields (`membership_status`, `credits_balance`, `member_since`, `next_renewal`, `last_rotation_used`, `last_lens_refresh`) from the customer projection
5. IF the customer is not a member, THE profile page SHALL not display the MembershipCard or CreditsLedger sections
