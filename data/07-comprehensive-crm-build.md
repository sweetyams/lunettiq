# Spec 07: Comprehensive CRM Build — Roles, Try-On, AI Segmentation, Loyalty, Client Data Model

**Status:** DRAFT — supersedes portions of specs 02, 05, 06
**Target IDE:** Kiro (or Cursor)
**Dependencies:** Clerk Organizations enabled, Anthropic SDK, MediaPipe Face Mesh (or Jeeliz FaceFilter as paid alternative), Klaviyo API
**Last updated:** April 2026

---

## 0. What this doc covers

Three areas the brief asked for, built to production depth:

1. **Role and permission system** — full Clerk Organizations setup, all 5 active roles + 4 future roles pre-wired, ~90 permissions, location scoping, invitation lifecycle, admin UI
2. **Product recommendations + virtual try-on** — catalogue browsing from multiple entry points, intelligent matching, browser-based AR try-on, likes/dislikes capture, behavioural event stream, Klaviyo segment auto-targeting
3. **AI-powered segmentation** — manual rule builder with deep field access plus a Claude-driven analyst that reads sales data and proposes segments with rationale

Plus the client data model additions the brief calls out explicitly:

4. **Client profile completeness** — all contact fields, custom fields, purchase and return history, tagging, interaction timeline surface, consent toggles, reporting and export

Deferred to later specs (flagged where they connect): custom designs module, Second Sight intake UI, messaging composition UI, admin business config, storefront account page.

---

## 1. Role and permission system

### 1.1 Scope of this section

Supersedes spec 02. Builds everything in `lunettiq-clerk-permissions.md` end-to-end: Clerk Organizations, all roles (active + future), all permissions, location scoping via membership metadata, MFA enforcement, surface identification, invitation lifecycle, in-app management UI, audit.

### 1.2 Clerk setup — one-time dashboard work

Before any code: configure Clerk.

1. **Enable Organizations.** Clerk Dashboard → Organizations → Enable.
2. **Create the organization.** Slug: `lunettiq`. One org for the brand. Not one per location.
3. **Create the 9 roles.** Five active, four future (no one assigned yet). Use these exact keys:

```
org:owner
org:manager
org:optician
org:sales_associate
org:read_only
org:stylist          (future — don't assign users in V1)
org:production       (future)
org:marketing        (future)
org:partner          (future)
```

Clerk system roles `org:admin` and `org:member` still exist — map `org:owner` to admin tier, everything else to member.

4. **Create all permissions** from §1.4 below.
5. **Assign permissions to roles** per §1.5.
6. **Configure MFA** per §1.6.
7. **Configure session durations** per §1.7.

### 1.3 Seeding script

Don't do this by hand. Build a script that Clerk API can run idempotently, so it can be re-run when roles or permissions change.

**File:** `scripts/seed-clerk-permissions.ts`

```ts
import { createClerkClient } from '@clerk/backend';

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
const ORG_ID = process.env.CLERK_ORG_ID!;

const PERMISSIONS = [
  // Clients
  { key: 'org:clients:read', name: 'View clients', description: 'View client profiles' },
  { key: 'org:clients:create', name: 'Create clients', description: 'Create new clients' },
  { key: 'org:clients:update', name: 'Update clients', description: 'Edit client fields' },
  { key: 'org:clients:delete', name: 'Delete clients', description: 'Soft-delete clients' },
  { key: 'org:clients:merge', name: 'Merge clients', description: 'Merge duplicate clients' },
  { key: 'org:clients:export_single', name: 'Export single client', description: 'Export one client record' },
  { key: 'org:clients:export_bulk', name: 'Export client list', description: 'Bulk export' },
  // ... full list from §1.4
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  'org:owner':           ['*'], // all permissions
  'org:manager':         [/* from §1.5.2 */],
  'org:optician':        [/* from §1.5.3 */],
  'org:sales_associate': [/* from §1.5.4 */],
  'org:read_only':       [/* from §1.5.5 */],
  'org:stylist':         [/* from §1.5.6 */],
  'org:production':      [/* from §1.5.7 */],
  'org:marketing':       [/* from §1.5.8 */],
  'org:partner':         [/* from §1.5.9 */],
};

async function seed() {
  // 1. Upsert permissions
  for (const perm of PERMISSIONS) {
    await clerk.organizations.upsertPermission(ORG_ID, perm).catch(handleIdempotent);
  }

  // 2. Upsert role-permission assignments
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const resolved = perms.includes('*') ? PERMISSIONS.map(p => p.key) : perms;
    await clerk.organizations.setRolePermissions(ORG_ID, role, resolved);
  }

  console.log('Seeded', PERMISSIONS.length, 'permissions across', Object.keys(ROLE_PERMISSIONS).length, 'roles');
}

seed().catch(console.error);
```

Run with `pnpm tsx scripts/seed-clerk-permissions.ts`. Add to package.json as `db:seed-clerk`. Re-run whenever permissions change.

> Note: Clerk's Backend SDK may not expose `upsertPermission` directly as written — verify against current Clerk API. Some versions require permissions via dashboard only. If so, this script becomes a validator that checks the dashboard matches the source of truth and logs mismatches instead of creating.

### 1.4 Permissions — complete list

16 categories, ~90 permissions. Source of truth. Any code that calls `has({ permission })` must use one of these exact keys.

```
# Clients
org:clients:read
org:clients:create
org:clients:update
org:clients:delete
org:clients:merge
org:clients:export_single
org:clients:export_bulk

# Rx / Medical
org:rx:read
org:rx:update
org:rx:delete
org:fit_profile:read
org:fit_profile:update

# Preferences
org:preferences:read
org:preferences:update

# Tags
org:tags:apply
org:tags:bulk_apply
org:tags:manage_taxonomy

# Interactions
org:interactions:read
org:interactions:create
org:interactions:update
org:interactions:delete

# Orders
org:orders:read
org:orders:read_all

# Products
org:products:read
org:products:read_sales_history
org:products:recommend

# Segments
org:segments:read
org:segments:create
org:segments:update
org:segments:delete
org:segments:sync_klaviyo

# Second Sight
org:second_sight:read
org:second_sight:create
org:second_sight:update
org:second_sight:approve_grade
org:second_sight:list_shopify

# Custom Designs
org:custom_designs:read
org:custom_designs:create
org:custom_designs:update
org:custom_designs:submit_review
org:custom_designs:approve
org:custom_designs:update_production_status

# Appointments
org:appointments:read
org:appointments:create
org:appointments:update
org:appointments:delete

# Membership & Credits
org:membership:read
org:membership:update_tier
org:membership:update_status
org:credits:read
org:credits:adjust

# Consent & Messaging
org:consent:read
org:consent:update
org:campaigns:read
org:campaigns:create
org:messaging:send_direct

# Try-On & Recommendations (new for this spec)
org:tryon:read
org:tryon:initiate
org:tryon:view_history
org:recs:read
org:recs:create
org:recs:manage_feedback

# Reports
org:reports:read
org:reports:export
org:reports:cross_location

# Audit
org:audit:read_own_location
org:audit:read_all

# Settings
org:settings:locations
org:settings:staff
org:settings:tags
org:settings:integrations
org:settings:consent_policy
org:settings:business_config
```

### 1.5 Role → permission assignments

Full matrices below. Copy directly into the seeding script.

#### 1.5.1 Owner — all permissions

Use wildcard in the seed script (`['*']`) which expands to every permission above.

#### 1.5.2 Manager

```
clients: read, create, update, merge, export_single, export_bulk
rx: read
fit_profile: read, update
preferences: read, update
tags: apply, bulk_apply
interactions: read, create, update, delete
orders: read, read_all
products: read, read_sales_history, recommend
segments: read, create, update, delete, sync_klaviyo
second_sight: read, create, update, approve_grade, list_shopify
custom_designs: read, create, update, submit_review
appointments: read, create, update, delete
membership: read, update_tier, update_status
credits: read, adjust
consent: read, update
campaigns: read, create
messaging: send_direct
tryon: read, initiate, view_history
recs: read, create, manage_feedback
reports: read, export
audit: read_own_location
```

#### 1.5.3 Optician

```
clients: read, update
rx: read, update, delete
fit_profile: read, update
preferences: read
interactions: read, create, update, delete
orders: read
products: read
tryon: read, initiate
recs: read, create
appointments: read, create, update
custom_designs: read, update
membership: read
credits: read
consent: read
```

> App-level rule: opticians are not location-scoped. A client's Rx belongs to the brand, not a store. Section 1.8 covers the scoping bypass.

#### 1.5.4 Sales Associate

```
clients: read, create, update, export_single
rx: read
fit_profile: read, update
preferences: read, update
tags: apply
interactions: read, create, update, delete
orders: read
products: read, recommend
segments: read, create, update
second_sight: read, create, update
custom_designs: read, create, update, submit_review
appointments: read, create, update
membership: read
credits: read
consent: read, update
tryon: read, initiate, view_history
recs: read, create, manage_feedback
```

#### 1.5.5 Read-Only

```
clients: read, export_single, export_bulk
rx: read
fit_profile: read
preferences: read
interactions: read
orders: read, read_all
products: read, read_sales_history
segments: read
second_sight: read
custom_designs: read
appointments: read
membership: read
credits: read
consent: read
campaigns: read
reports: read, export, cross_location
tryon: read, view_history
recs: read
```

#### 1.5.6 Stylist (future)

Inherits SA plus:

```
tags: bulk_apply
second_sight: approve_grade
messaging: send_direct
recs: manage_feedback (already in SA, reinforcing)
```

#### 1.5.7 Production (future)

Deliberately narrow:

```
custom_designs: read, update_production_status
clients: read (name + contact only — app-enforced, see §1.8)
rx: read (app-enforced scope to designs in production)
```

#### 1.5.8 Marketing (future)

```
clients: read
segments: read, create, update, delete, sync_klaviyo
campaigns: read, create
messaging: send_direct
reports: read, export
products: read
preferences: read
consent: read
tryon: read, view_history
recs: read
```

No Rx, no fit profile, no credits, no custom designs.

#### 1.5.9 Partner (future)

```
products: read
clients: read (app-enforced to assigned segment only)
```

### 1.6 MFA configuration

In Clerk Dashboard → User & Authentication → Multi-factor:

| Role | MFA |
|---|---|
| org:owner | **Required** |
| org:manager | **Required** |
| org:optician | **Required** (medical data) |
| org:sales_associate | Optional |
| org:read_only | Optional |
| org:stylist | Optional |
| org:production | Required |
| org:marketing | Required |
| org:partner | Optional |

Clerk enforces this on sign-in. No app code needed.

### 1.7 Session durations

Clerk Dashboard → Sessions:

- Web: 7 days idle timeout
- Mobile (set via SDK): 14 days idle with biometric unlock on foreground

### 1.8 Location scoping (membership metadata)

Permissions define what you can do. Location metadata defines which rows you can see. They're orthogonal.

Shape on `OrganizationMembership.publicMetadata`:

```ts
{
  location_ids: string[];          // locations this user serves
  primary_location_id: string;     // default location for new records
  can_view_all_locations: boolean; // bypass flag for owner
  bypass_location_scope: boolean;  // separate flag for opticians
}
```

**Why two bypass flags:** `can_view_all_locations` is for owners (authority). `bypass_location_scope` is for role-based exceptions (opticians need cross-location Rx access without being owners). Keep them separate so rule changes don't cascade.

**Enforcement helper:**

**File:** `src/lib/crm/location-scope.ts`

```ts
import { auth } from '@clerk/nextjs/server';
import { and, inArray, SQL } from 'drizzle-orm';

export async function getLocationScope() {
  const { orgRole, sessionClaims } = await auth();
  const metadata = (sessionClaims?.org_membership_metadata ?? {}) as {
    location_ids?: string[];
    can_view_all_locations?: boolean;
    bypass_location_scope?: boolean;
  };

  const bypass = metadata.can_view_all_locations === true
              || metadata.bypass_location_scope === true;

  return {
    bypass,
    locationIds: metadata.location_ids ?? [],
    primaryLocationId: metadata.primary_location_id,
  };
}

export function applyLocationFilter<T extends { location_id: any }>(
  table: T,
  scope: Awaited<ReturnType<typeof getLocationScope>>
): SQL | undefined {
  if (scope.bypass) return undefined;
  if (scope.locationIds.length === 0) return undefined; // no access
  return inArray(table.location_id, scope.locationIds);
}
```

Every location-scoped query uses this:

```ts
const scope = await getLocationScope();
const filter = applyLocationFilter(appointments, scope);
const rows = await db.select().from(appointments).where(and(otherConditions, filter));
```

Production role scope enforcement is app-level only: the custom designs route for production users filters to `status IN ('in_production', 'approved')` and the clients endpoint returns a stripped payload with only `{ firstName, lastName, phone, email }` — not the full profile.

### 1.9 Surface identification

Every request from a staff surface sends a header:

```
X-CRM-Surface: web | tablet | phone
```

Middleware reads it and attaches to the request context for audit logging:

**File:** `src/middleware.ts` (addition)

```ts
export function middleware(req: NextRequest) {
  const surface = req.headers.get('x-crm-surface') ?? 'unknown';
  const res = NextResponse.next();
  res.headers.set('x-crm-surface-recorded', surface);
  return res;
}
```

Audit log writer pulls from the header every time.

### 1.10 In-app permission check helpers

**File:** `src/lib/crm/permissions.ts` (extend existing)

```ts
import { auth } from '@clerk/nextjs/server';

export async function requirePermission(permission: string) {
  const { has } = await auth();
  if (!has({ permission })) {
    throw new Response('Forbidden', { status: 403 });
  }
}

export async function requireAnyPermission(permissions: string[]) {
  const { has } = await auth();
  const ok = permissions.some(p => has({ permission: p }));
  if (!ok) throw new Response('Forbidden', { status: 403 });
}

export async function hasPermission(permission: string) {
  const { has } = await auth();
  return has({ permission });
}
```

Client-side:

**File:** `src/lib/crm/use-permissions.ts`

```ts
'use client';
import { useOrganization } from '@clerk/nextjs';

export function usePermission(permission: string) {
  const { membership } = useOrganization();
  return membership?.permissions.includes(permission) ?? false;
}

export function useAnyPermission(permissions: string[]) {
  const { membership } = useOrganization();
  return permissions.some(p => membership?.permissions.includes(p));
}
```

UI pattern: wrap conditional rendering in these hooks. Never hide security decisions in CSS.

```tsx
const canAdjustCredits = usePermission('org:credits:adjust');

{canAdjustCredits && <AdjustCreditsButton />}
```

### 1.11 Staff lifecycle APIs

Rebuilt from spec 02, extended for the full role set.

#### Invite

**File:** `src/app/api/crm/staff/invite/route.ts`

```
POST /api/crm/staff/invite
Auth: org:settings:staff
Body: {
  email: string,
  role: string,           // must be one of the 9 role keys
  locationIds: string[],
  primaryLocationId: string,
  personalNote?: string
}
```

Validation:
- `role` must be in the allowlist
- `locationIds` must all exist in the `locations` table
- `primaryLocationId` must be in `locationIds`
- If role is `org:owner` or `org:manager`, inviter must be `org:owner` (owners invite owners, only owners promote to manager via initial invite)

Implementation:
1. Call Clerk `organizations.createOrganizationInvitation` with role + publicMetadata
2. If `personalNote` provided, pass as `publicMetadata.invitation_note` — shown in the invite email template
3. Insert into `audit_log`: action=`invite`, actor=inviter, target=email, metadata={role, locationIds}

#### Update role / locations

**File:** `src/app/api/crm/staff/[id]/route.ts`

```
PATCH /api/crm/staff/[id]
Auth: org:settings:staff
Body: {
  role?: string,
  locationIds?: string[],
  primaryLocationId?: string,
  canViewAllLocations?: boolean,
  bypassLocationScope?: boolean
}
```

Validation:
- Demoting an owner requires a second owner to exist
- Only owner can promote to owner
- `bypassLocationScope` can only be set to true by owner (and only for opticians as policy)

Implementation:
1. Fetch current membership
2. Diff against proposed changes
3. Call Clerk `organizations.updateOrganizationMembership` with new role + metadata
4. Audit log with full diff

#### Suspend / reinstate

**File:** `src/app/api/crm/staff/[id]/suspend/route.ts`

```
POST /api/crm/staff/[id]/suspend
Body: { action: 'suspend' | 'reinstate', reason?: string }
```

Suspend: `clerkClient.users.banUser(userId)` — Clerk invalidates all sessions.
Reinstate: `clerkClient.users.unbanUser(userId)`.
Audit log.

#### Offboard

**File:** `src/app/api/crm/staff/[id]/offboard/route.ts`

```
POST /api/crm/staff/[id]/offboard
Body: { confirmName: string }  // staff member types name to confirm
```

Server-side steps, in a transaction where possible:

1. Validate `confirmName` matches the user's full name
2. Reassign open appointments → `staffId = null`, flag as `needs_reassignment`
3. Reassign open Second Sight intakes → same pattern
4. Reassign open custom designs → transfer to inviter (usually manager)
5. Generate activity summary PDF (§1.13), store in R2 under `staff-offboarding/[userId]/[date].pdf`
6. Ban Clerk user
7. Set publicMetadata: `{ offboarded: true, offboarded_at: ISO, offboarded_by: actorId }`
8. Audit log with full summary

### 1.12 Staff management UI

**File:** `src/app/crm/settings/staff/page.tsx` — server component
**File:** `src/app/crm/settings/staff/StaffManagementClient.tsx` — client

Layout described in spec 02, extended here with:

- **Role filter** includes all 9 roles (inactive ones marked "Unassigned" in the filter)
- **Permissions inspector modal** — click any staff row → "View permissions" → modal shows the resolved permission list grouped by category. Useful for debugging "why can't I do X."
- **Role change requires reason field** when changing role between tiers that differ by permission count > 10 (e.g., SA → Manager)
- **Audit view** on staff row — opens a modal showing recent actions this user has taken in the last 30 days, pulled from `audit_log`

### 1.13 Offboarding activity report

Generated as PDF at offboard time. Contains:

- Staff member info, role history, location assignments, dates
- Interactions logged (count, by type, date range)
- Clients served (count, top 20 by interaction volume)
- Intakes processed, designs drafted, appointments run
- Flagged issues (missed appointments, overdue tasks at time of offboard)

Uses the `pdf` skill in the docs repo. Stored in R2, linked from audit log entry, downloadable by owner within 2 years.

### 1.14 Audit completeness

Every action in §1.11 writes to `audit_log` with:

```
actor_id, actor_role, target_id, target_type, action, surface, location_id, before, after, reason, ip_address, user_agent, created_at
```

Queryable at `/settings/audit`. Two levels: `org:audit:read_own_location` (managers, filtered) and `org:audit:read_all` (owner).

### 1.15 Done criteria — Role system

- [ ] Clerk Organizations enabled, 9 roles created, all permissions seeded via script
- [ ] Role-permission matrix matches §1.5 exactly (validation test)
- [ ] MFA enforced per §1.6 in Clerk dashboard
- [ ] Location scope helper (`getLocationScope`, `applyLocationFilter`) used in every scoped query
- [ ] `X-CRM-Surface` header written by all clients, read by middleware, stored in audit
- [ ] Permission check helpers (server + client) exported and used consistently
- [ ] Invite API validates role transitions, writes audit
- [ ] Role/location edit API with full diff audit
- [ ] Suspend / reinstate via Clerk ban
- [ ] Offboard: reassigns open work, generates activity PDF, bans user, audits
- [ ] Staff management UI shows all active + pending invites + suspended users
- [ ] Permissions inspector modal for any user
- [ ] Audit viewer at `/settings/audit` with location filter for managers

---

## 2. Product recommendations + virtual try-on

### 2.1 Scope of this section

Supersedes spec 05. Covers:

- Product search and filtering from multiple entry points (product list, client profile, tablet fitting room)
- Recommendation engine: face shape, fit measurements, preferences, purchase history
- Virtual try-on: browser-based face tracking, frame overlay, capture and share
- Behavioural event capture: views, likes, dislikes, try-ons, shares
- Klaviyo segment auto-targeting driven by this behavioural data
- Recommendation analytics: conversion rate, most-tried frames

### 2.2 Entry points (IA)

Recommendations and try-on can start from four places. The flow converges on the same underlying components.

```
1. /crm/products                    → Browse catalogue, recommend to any client
2. /crm/clients/[id]                → Suggestions panel + "Recommend product" CTA
3. /crm/tryon?clientId=X            → Direct link to try-on session
4. Tablet app → Fitting room mode   → Full-screen try-on with client present
```

All four call the same APIs. The UI shell differs.

### 2.3 Data model additions

Add to `src/lib/db/schema.ts`:

```ts
// Track every interaction with a product recommendation or try-on
export const productInteractions = pgTable('product_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  shopifyProductId: text('shopify_product_id').notNull(),
  shopifyVariantId: text('shopify_variant_id'), // null if product-level
  interactionType: text('interaction_type', {
    enum: ['viewed', 'recommended', 'tried_on', 'liked', 'disliked', 'shared', 'saved', 'purchased']
  }).notNull(),
  source: text('source', {
    enum: ['crm_web', 'tablet', 'storefront', 'klaviyo_click', 'system']
  }).notNull(),
  staffId: text('staff_id'),               // null for customer-initiated
  locationId: text('location_id'),
  sessionId: text('session_id'),           // groups try-ons in one fitting
  metadata: jsonb('metadata'),             // {tryOnDuration, angle, screenshotUrl, etc.}
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
}, (t) => ({
  customerIdx: index().on(t.shopifyCustomerId, t.occurredAt),
  productIdx: index().on(t.shopifyProductId, t.occurredAt),
  typeIdx: index().on(t.interactionType),
  sessionIdx: index().on(t.sessionId),
}));

// Aggregated feedback per (customer, product) — updated by trigger or cron
export const productFeedback = pgTable('product_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  shopifyProductId: text('shopify_product_id').notNull(),
  sentiment: text('sentiment', { enum: ['love', 'like', 'neutral', 'dislike'] }),
  tryOnCount: integer('try_on_count').default(0),
  viewCount: integer('view_count').default(0),
  lastInteractionAt: timestamp('last_interaction_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  uniqueIdx: uniqueIndex().on(t.shopifyCustomerId, t.shopifyProductId),
}));

// Try-on sessions — a fitting has many try-ons
export const tryOnSessions = pgTable('try_on_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  staffId: text('staff_id'),
  locationId: text('location_id'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  framesTried: integer('frames_tried').default(0),
  outcomeTag: text('outcome_tag', {
    enum: ['purchased', 'saved_for_later', 'no_match', 'needs_followup']
  }),
  notes: text('notes'),
}, (t) => ({
  customerIdx: index().on(t.shopifyCustomerId, t.startedAt),
}));
```

### 2.4 Product search API

Extended from spec 05's lightweight version.

**File:** `src/app/api/crm/products/search/route.ts`

```
GET /api/crm/products/search
Auth: org:products:read
Query:
  q           search string (fuzzy over title, vendor, tags)
  type        filter by product_type
  vendor      filter by vendor
  shape       filter by shape tag
  colour      filter by colour tag
  material    filter by material tag
  size        small | large
  priceMin    number
  priceMax    number
  faceShape   filters to frames recommended for this face shape
  customerId  if provided, personalizes ordering by recommendation score
  sort        relevance | price_asc | price_desc | newest | most_tried
  limit       default 20, max 100
  cursor      opaque pagination token
```

Response:

```ts
{
  data: Array<{
    shopifyProductId: string;
    handle: string;
    title: string;
    vendor: string;
    priceMin: number;
    priceMax: number;
    imageUrl: string;
    tags: string[];
    availableAtLocations: string[]; // which locations have inventory
    totalInventory: number;
    matchScore?: number;            // present when customerId is set
    matchReasons?: string[];        // e.g. ["face-shape: oval", "prefers: acetate"]
    tryOnReady: boolean;            // does this product have try-on assets?
    recentTries?: number;           // this customer's try count in last 90 days
  }>;
  pageInfo: { hasNext: boolean; nextCursor?: string };
}
```

Scoring logic (when `customerId` provided) extracted to `src/lib/crm/recommendations/score.ts`:

```ts
export function scoreProduct(product: ProductProjection, context: {
  customer: CustomerProjection;
  stated: StatedPreferences;
  derived: DerivedPreferences;
  purchasedProductIds: Set<string>;
  feedback: Map<string, 'love' | 'like' | 'neutral' | 'dislike'>;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Already purchased — exclude unless customer bought multiple times
  if (context.purchasedProductIds.has(product.id)) {
    return { score: -1000, reasons: ['already purchased'] };
  }

  // Previously disliked
  const prev = context.feedback.get(product.id);
  if (prev === 'dislike') return { score: -1000, reasons: ['previously disliked'] };
  if (prev === 'love') score += 10;
  if (prev === 'like') score += 5;

  // Face shape match (tag convention: "face-shape:oval" applied by catalogue team)
  const faceShape = context.customer.metafields?.custom?.face_shape;
  if (faceShape && product.tags.includes(`face-shape:${faceShape.toLowerCase()}`)) {
    score += 8;
    reasons.push(`suits ${faceShape} face`);
  }

  // Stated preferences
  for (const shape of context.stated.shapes ?? []) {
    if (product.tags.includes(`shape:${shape}`)) {
      score += 6;
      reasons.push(`${shape} shape`);
    }
  }
  for (const material of context.stated.materials ?? []) {
    if (product.tags.includes(`material:${material}`)) {
      score += 4;
      reasons.push(`${material}`);
    }
  }
  for (const colour of context.stated.colours ?? []) {
    if (product.tags.includes(`colour:${colour}`)) {
      score += 3;
      reasons.push(`${colour}`);
    }
  }

  // "Avoid" overrides
  for (const avoid of context.stated.avoid ?? []) {
    if (product.tags.some(t => t.includes(avoid))) {
      return { score: -1000, reasons: [`avoids ${avoid}`] };
    }
  }

  // Derived preferences (weighted by confidence)
  for (const [shape, weight] of Object.entries(context.derived.shapes ?? {})) {
    if (product.tags.includes(`shape:${shape}`)) {
      score += Math.min(weight as number, 3);
    }
  }

  // Price range comfort zone
  const avgPrice = context.derived.price_range?.avg;
  if (avgPrice && product.priceMin <= avgPrice * 1.3 && product.priceMax >= avgPrice * 0.7) {
    score += 2;
    reasons.push('in your usual price range');
  }

  // Fit — frame width vs customer measurement
  const customerWidth = context.customer.metafields?.custom?.frame_width_mm;
  if (customerWidth && product.metafields?.custom?.frame_width) {
    const diff = Math.abs(product.metafields.custom.frame_width - customerWidth);
    if (diff <= 2) { score += 5; reasons.push('exact fit'); }
    else if (diff <= 4) { score += 2; }
    else if (diff > 8) { score -= 4; }
  }

  return { score, reasons };
}
```

Scoring weights are constants — tune based on conversion data from `product_interactions` after 6 months.

### 2.5 Product detail enhancements

Existing `/crm/products/[id]` page adds:

- **Inventory-by-location panel** — which stores have it, how many
- **Recommendation heatmap** — how often this product has been tried, liked, disliked (last 90 days, filterable)
- **"Who loves this"** — client list (top 20) who tagged this with `love` or `like`, filtered to viewer's locations
- **Conversion funnel** — views → try-ons → purchases, as a small chart
- **Actions row:**
  - Recommend to client (opens ClientPicker)
  - Start try-on session (opens try-on with product pre-loaded)
  - Add to wishlist (if viewing with client context)

### 2.6 Virtual try-on — technical approach

This is the biggest unknown in the brief. Be honest about what's involved.

**Recommended stack for V1:**
- **MediaPipe Face Mesh** — free, runs in-browser via WASM, tracks 468 face landmarks at 30fps, good on iPad
- **Three.js** — render the frame as a 3D model aligned to the face
- **Per-product 3D assets** — each frame needs a glTF/GLB file with anchor points

Honest trade-offs:
- MediaPipe is good, not perfect. Jeeliz and Banuba ($10k-50k/year) are better at fast head movement, poor lighting, and partial occlusion. Fine to start free and upgrade.
- Every product needs a 3D model. That's a production cost — $50-200 per frame to photograph and model, or you source from the manufacturer. Without models, try-on is not possible for that product. Tag products as `tryOnReady` in the catalogue.
- iPad Safari works. Android Chrome works. iPhone Safari works but cameras heat up after ~3 minutes.

**File:** `src/lib/tryon/engine.ts`

Abstraction layer so the rendering engine can be swapped later:

```ts
export interface TryOnEngine {
  init(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): Promise<void>;
  loadFrame(glbUrl: string, anchors: FrameAnchors): Promise<void>;
  start(): void;
  pause(): void;
  capture(): Promise<Blob>;      // still frame with frame overlay
  dispose(): void;

  onFaceDetected?: (landmarks: FaceLandmarks) => void;
  onTrackingLost?: () => void;
}

export interface FrameAnchors {
  // Measurements that let the renderer align the 3D model to face landmarks
  nosePad: { x: number; y: number; z: number };
  templeLength: number;
  bridgeWidth: number;
  lensWidth: number;
}

export async function createEngine(provider: 'mediapipe' | 'jeeliz' = 'mediapipe'): Promise<TryOnEngine> {
  if (provider === 'mediapipe') {
    const { MediaPipeEngine } = await import('./engines/mediapipe');
    return new MediaPipeEngine();
  }
  // Jeeliz path added later
  throw new Error(`Unknown engine: ${provider}`);
}
```

**File:** `src/lib/tryon/engines/mediapipe.ts` — MediaPipe implementation. Dynamic import so it doesn't bloat the main bundle (MediaPipe WASM is ~4MB).

### 2.7 Try-on UI — web

**File:** `src/app/crm/tryon/page.tsx` — server component, checks `org:tryon:initiate`
**File:** `src/app/crm/tryon/TryOnClient.tsx` — client component

Layout:

```
┌────────────────────────────────────────────────────────────┐
│ ← Back   Try-On Session · [Client: Marie D.]      [End]   │
├──────────────────────────────┬─────────────────────────────┤
│                              │  Session                    │
│                              │  00:04:32  ·  3 frames      │
│                              │                             │
│      [Live camera feed       │  Currently trying:          │
│       with frame overlay]    │  Senna · Black · $285       │
│                              │                             │
│                              │  [ 👎 ] [ 🤷 ] [ ❤️ ]        │
│                              │                             │
│                              │  [📸 Capture] [↗ Share]    │
│                              │                             │
│                              │  ─────────                  │
│                              │  Up next (4)                │
│                              │  ┌────┐ ┌────┐ ┌────┐      │
│                              │  │ A  │ │ B  │ │ C  │      │
│                              │  └────┘ └────┘ └────┘      │
├──────────────────────────────┴─────────────────────────────┤
│  Already tried (3): Marais ❤️  Astoria 🤷  Draper 👎       │
└────────────────────────────────────────────────────────────┘
```

State management:

```tsx
const [session, setSession] = useState<TryOnSession | null>(null);
const [currentFrame, setCurrentFrame] = useState<Product | null>(null);
const [triedFrames, setTriedFrames] = useState<TriedFrame[]>([]);
const [queue, setQueue] = useState<Product[]>([]);
const engineRef = useRef<TryOnEngine | null>(null);
```

On frame change: swap GLB, record `viewed` interaction. On sentiment tap: record `liked`/`disliked` + update current frame's sentiment. On capture: save still to R2, insert `shared` interaction, show share modal.

### 2.8 Try-on UI — tablet (fitting room mode)

Full-screen. Client-facing. SA controls via small remote panel in corner.

**File:** `apps/tablet/src/screens/FittingRoom.tsx`

Same engine, different shell:
- No CRM chrome
- Large capture button
- Swipe gestures: left = dislike, right = like, up = save, down = next
- SA controls hidden in a collapsible drawer
- When client taps "❤️": frame added to their wishlist immediately, visible on the SA's phone app if they have it open

### 2.9 Try-on APIs

**Start session:**

```
POST /api/crm/tryon/sessions
Auth: org:tryon:initiate
Body: { customerId: string, initialProductIds?: string[] }
Returns: { sessionId, queue: Product[] }
```

Initial queue: if `initialProductIds` provided, use them. Otherwise top 8 from recommendations.

**Record interaction:**

```
POST /api/crm/tryon/interactions
Auth: org:tryon:initiate
Body: {
  sessionId: string,
  productId: string,
  variantId?: string,
  type: 'viewed' | 'tried_on' | 'liked' | 'disliked' | 'saved' | 'shared',
  metadata?: { duration?: number, screenshotUrl?: string }
}
```

Writes to `product_interactions`. On `liked`/`disliked`/`saved`, also upserts `product_feedback`.

**End session:**

```
POST /api/crm/tryon/sessions/[id]/end
Body: { outcomeTag: 'purchased' | 'saved_for_later' | 'no_match' | 'needs_followup', notes?: string }
```

Writes end timestamp, frames tried count, outcome. Creates interaction timeline entry on the client profile.

**Session history:**

```
GET /api/crm/clients/[id]/tryon-sessions
Auth: org:tryon:view_history
Returns: past sessions with frames tried and outcomes
```

### 2.10 Likes, dislikes, saved — UI surfaces

On the client profile (right column), new "Try-on history" section:

```
Try-on history                                    View all →
┌─────────────────────────────────────────────────┐
│ Session · Apr 12 · Plateau · with Emma          │
│ 4 frames tried · outcome: saved for later       │
│                                                  │
│ ❤️ Senna Black     · tried 3:20                 │
│ ❤️ Draper Tortoise · tried 2:15                 │
│ 🤷 Astoria Olive   · tried 1:05                 │
│ 👎 Marais Crystal  · tried 0:45                 │
└─────────────────────────────────────────────────┘
```

Wishlist panel (liked + saved) — separate component. Staff can convert wishlist items to a draft Shopify order.

### 2.11 Behavioural events → Klaviyo

Every `product_interaction` of type `liked`, `disliked`, `tried_on`, `saved`, or `shared` fires a Klaviyo custom event.

**File:** `src/lib/klaviyo/events.ts`

```ts
export async function fireKlaviyoEvent(
  customerEmail: string,
  eventName: string,
  properties: Record<string, any>
) {
  if (!customerEmail) return; // no email, no event
  const res = await fetch('https://a.klaviyo.com/api/events/', {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_KEY}`,
      'revision': '2024-10-15',
      'accept': 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'event',
        attributes: {
          metric: { data: { type: 'metric', attributes: { name: eventName } } },
          profile: { data: { type: 'profile', attributes: { email: customerEmail } } },
          properties,
        },
      },
    }),
  });
  if (!res.ok) {
    // Log but don't throw — Klaviyo issues shouldn't break the CRM
    console.warn('Klaviyo event failed', eventName, await res.text());
  }
}
```

Event names emitted:

```
Tried On Frame
Liked Frame
Disliked Frame
Saved Frame
Shared Frame
Completed Fitting Session
```

Properties on each event include `productId`, `productTitle`, `variantId`, `price`, `tags`, `sessionId`, `staffId` (if applicable), `locationId`.

### 2.12 Auto-targeting segments

With events flowing to Klaviyo, these segments become available (configured in Klaviyo once, then fire automatically):

| Segment | Klaviyo rule |
|---|---|
| Abandoned try-on | `Tried On Frame` in last 3 days AND no `Order Placed` in last 3 days |
| Loved but didn't buy | `Liked Frame` count > 1 in last 14 days AND no `Order Placed` in 14 days |
| High-intent browsers | `Tried On Frame` count ≥ 3 in last 7 days |
| Ready for second pair | `Order Placed` 6-12 months ago AND `Liked Frame` in last 30 days |

These drive Klaviyo flows (post-fitting email, second-pair nudge, etc.) without any CRM intervention.

### 2.13 Recommendations — from client profile

Extending spec 05's ProductSuggestions:

- 3 tabs: **Smart picks** (the scored list), **Loved by similar clients** (collaborative filter — V2, uses face shape + purchase overlap), **Trending in your locations** (top purchased last 30 days)
- Each card shows match reasons as chips
- Actions per card: Recommend (creates interaction), Start try-on (adds to queue), View PDP

### 2.14 Recommendations analytics

**File:** `src/app/crm/reports/recommendations/page.tsx`

Owner + manager view:

- Recommendations made → interactions → conversions (funnel)
- Top recommending staff (volume + conversion rate)
- Top recommended products (volume + conversion rate)
- Most-tried frames that never convert (flag for range review)
- Average try-ons per session
- Average session length
- Outcome distribution (purchased, saved, no match)

Time range filter, location filter. Export CSV.

### 2.15 Done criteria — Recommendations & Try-on

- [ ] `product_interactions`, `product_feedback`, `try_on_sessions` tables created
- [ ] Product search API with scoring when `customerId` provided
- [ ] Score function extracted, tested with unit tests covering all branches
- [ ] Product detail page shows inventory-by-location, try-on heatmap, who-loves-this
- [ ] Try-on engine abstraction with MediaPipe implementation
- [ ] `/crm/tryon` page with session state, sentiment capture, queue management
- [ ] Tablet fitting-room mode
- [ ] Try-on APIs: start session, record interaction, end session, session history
- [ ] Klaviyo event firing on all sentiment interactions
- [ ] Klaviyo auto-targeting segments documented and configured
- [ ] Client profile shows try-on history + wishlist
- [ ] Recommendations analytics page
- [ ] MediaPipe dynamic import (no bundle bloat)
- [ ] Graceful fallback when product has no 3D model (`tryOnReady=false` hides try-on button, shows still image instead)

---

## 3. AI-powered segmentation

### 3.1 Scope of this section

Supersedes spec 06. Covers both directions:

1. **Manual rule builder** with access to every useful data point (19 fields, nestable AND/OR)
2. **AI analyst** that reads aggregated sales data and proposes segments with rationale, costs, and expected impact

### 3.2 Manual rule builder — expanded fields

All operators: `equals`, `not_equals`, `contains`, `not_contains`, `greater_than`, `less_than`, `between`, `is_empty`, `is_not_empty`, `in_last_n_days`, `not_in_last_n_days`, `matches_any`, `matches_all`.

| Category | Field | Source |
|---|---|---|
| Identity | first_name, last_name, email_domain, pronouns, birthday_month | customers_projection |
| Identity | home_location | metafield custom.home_location |
| Geography | city, country, postal_prefix | default_address |
| Commercial | lifetime_value, total_orders, first_order_date, last_order_date, days_since_last_order, average_order_value | derived from orders_projection |
| Recency | created_at, days_since_created | customers_projection |
| Product | owns_product, owns_from_collection, bought_shape, bought_material, bought_colour, bought_size, owns_rx_frame, owns_sun | orders_projection + line_items |
| Try-on | try_on_count_30d, liked_count_30d, try_on_without_purchase_14d | product_interactions |
| Preferences | stated_shapes_includes, stated_materials_includes, stated_colours_includes, stated_avoid_includes, derived_price_range_avg | metafields + preferences_derived |
| Fit | face_shape, frame_width_mm, bridge_width_mm, rx_on_file, rx_days_since_updated | metafields |
| Membership | tier, status, credits_balance, days_until_renewal, last_rotation_used_days_ago, last_lens_refresh_days_ago | tags + metafields + credits_ledger |
| Engagement | interaction_count_30d, interaction_count_90d, last_interaction_type, last_interaction_days_ago | interactions table |
| Consent | email_consent, sms_consent, do_not_contact, consent_updated_days_ago | metafields |
| Tags | tag_includes, tag_excludes | customer_tags_projection |
| Custom | any custom metafield key | metafields JSONB |

### 3.3 Rule evaluation

Every rule compiles to SQL or Postgres function calls. No Shopify calls at query time — only the projection.

**File:** `src/lib/crm/segments/compiler.ts`

```ts
export function compileRule(rule: SegmentRule): SQL {
  switch (rule.field) {
    case 'lifetime_value':
      return sql`(
        SELECT COALESCE(SUM(total_price::numeric), 0)
        FROM orders_projection
        WHERE customer_id = customers_projection.shopify_customer_id
      ) ${compileOperator(rule.operator, rule.value)}`;
    // ...
  }
}

export function compileSegmentQuery(rules: RuleTree): SQL {
  // Recursively build WHERE clause from nested AND/OR tree
}
```

Every segment query runs against the projection. Expensive aggregations (LTV, last order date) are cached in materialized columns on customers_projection and refreshed by the webhook pipeline on order events.

### 3.4 AI analyst — architecture

Two modes:

**Mode A: Suggest segments.** User clicks "AI Suggest" → Claude receives aggregated (not individual) stats → returns 3-5 proposed segments with rationale.

**Mode B: Explain existing segment.** User opens a segment → clicks "Why this segment?" → Claude receives the rule definition + current member aggregates → returns plain-language explanation + suggested refinements.

No PII ever sent. No individual customer rows. Aggregates only.

### 3.5 Aggregator

**File:** `src/lib/crm/segments/aggregator.ts`

```ts
export type SalesAggregates = {
  dateRange: { from: string; to: string };
  totals: {
    customerCount: number;
    orderCount: number;
    grossRevenue: number;
    returnRate: number;
  };
  ltvDistribution: {
    p10: number; p25: number; p50: number; p75: number; p90: number; p99: number;
    mean: number;
  };
  orderFrequency: {
    oneOrder: number;
    twoToFive: number;
    sixToTen: number;
    elevenPlus: number;
  };
  recency: {
    lastOrder0_30days: number;
    lastOrder31_90days: number;
    lastOrder91_180days: number;
    lastOrder181_365days: number;
    lastOrder365plus: number;
  };
  tagFrequency: Array<{ tag: string; count: number }>; // top 40
  tierBreakdown: {
    nonMember: number;
    essential: number;
    cult: number;
    vault: number;
  };
  consentRates: {
    emailOptIn: number;
    smsOptIn: number;
  };
  tryOnActivity: {
    sessionsLast30d: number;
    avgFramesPerSession: number;
    conversionRate: number;
  };
  topProducts: Array<{ productTitle: string; units: number; revenue: number }>; // top 20, titles only
  topShapes: Array<{ shape: string; unitsLast90d: number }>;
  topMaterials: Array<{ material: string; unitsLast90d: number }>;
  locationBreakdown: Array<{ locationName: string; customers: number; revenue: number }>;
};

export async function buildAggregates(opts: {
  dateFrom?: Date;
  dateTo?: Date;
  locationIds?: string[];
}): Promise<SalesAggregates> {
  // Parallel DB queries, all aggregates, all anonymized
}
```

Cached for 15 minutes in Redis with a key based on the date range + location filter. Regenerates on cache miss.

### 3.6 Claude integration

**File:** `src/lib/ai/claude.ts`

```ts
import Anthropic from '@anthropic-ai/sdk';

export const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const MODELS = {
  fast: 'claude-haiku-4-5-20251001',   // suggestion extraction, simple analysis
  smart: 'claude-sonnet-4-6',           // segment proposal, explanation
} as const;
```

Model choice: use Sonnet 4.6 for segment suggestion (reasoning matters), Haiku 4.5 for simple extraction tasks. Opus 4.7 is overkill for this and expensive.

### 3.7 Suggest endpoint

**File:** `src/app/api/crm/segments/ai-suggest/route.ts`

```ts
export async function POST(req: Request) {
  await requirePermission('org:segments:create');

  const { dateRange, goal } = await req.json();

  const scope = await getLocationScope();
  const aggregates = await buildAggregates({
    dateFrom: dateRange?.from ? new Date(dateRange.from) : undefined,
    dateTo: dateRange?.to ? new Date(dateRange.to) : undefined,
    locationIds: scope.bypass ? undefined : scope.locationIds,
  });

  const systemPrompt = `You are a CRM segmentation analyst for Lunettiq, an independent eyewear brand in Montreal.
You propose customer segments based on aggregated sales data. You never see individual customer records.

Lunettiq has a three-tier membership program (Essential, CULT, VAULT) and a circular trade-in program (Second Sight).
The brand sells optical and sunglasses frames at $150-500 range. Primary locations: Plateau, Dix30.

Your job: given the aggregates below, propose 3-5 customer segments that would be strategically valuable to reach.
For each segment, return strict JSON matching the schema. No prose outside the JSON.

Each segment must:
- Have a clear, commercial reason to exist (retention, upsell, reactivation, cultural)
- Be expressible as rules against the available fields
- Include estimated size (absolute and % of base)
- Include a suggested action (campaign type, channel, message angle)
- Include a risk note (why this might not work, or who to exclude)

Available rule fields: ${AVAILABLE_FIELDS.join(', ')}
Available operators: equals, not_equals, greater_than, less_than, between, in_last_n_days, contains, tag_includes, tag_excludes
Tier tags: member-essential, member-cult, member-vault`;

  const userPrompt = `Sales aggregates:\n${JSON.stringify(aggregates, null, 2)}\n\n${
    goal ? `Specific goal from the user: ${goal}` : 'General proposal — identify the most valuable segments.'
  }

Return JSON: { "segments": [ { "name": string, "description": string, "rationale": string, "rules": RuleTree, "estimatedSize": number, "estimatedPercent": number, "suggestedAction": { "channel": "email" | "sms" | "in-store", "campaignType": string, "messageAngle": string }, "riskNote": string } ] }`;

  const response = await claude.messages.create({
    model: MODELS.smart,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content.filter(c => c.type === 'text').map(c => c.text).join('');
  const parsed = extractJson(text); // strips ```json fences, parses

  // Validate each segment's rules against the rule schema before returning
  const validated = parsed.segments.filter(s => isValidRuleTree(s.rules));

  // Preview member count for each segment
  const withCounts = await Promise.all(validated.map(async s => ({
    ...s,
    actualSize: await countSegmentMembers(s.rules, scope),
  })));

  return Response.json({ segments: withCounts, model: MODELS.smart, tokensUsed: response.usage });
}
```

### 3.8 Explain endpoint

```
POST /api/crm/segments/[id]/explain
Auth: org:segments:read
Returns: { explanation, refinementSuggestions[], overlapWithOtherSegments[] }
```

Claude receives: the rule definition + member count aggregates (LTV distribution, tier mix, recency) within the segment. Returns plain language explanation and 2-3 refinement suggestions ("remove members who already churned — -42 members").

### 3.9 Refine endpoint

```
POST /api/crm/segments/[id]/refine
Auth: org:segments:update
Body: { instruction: string }  // "tighten to just VIPs who haven't bought in 90 days"
Returns: { proposedRules: RuleTree, diff: { added: Rule[], removed: Rule[] }, newSize: number }
```

Conversational refinement — user describes the change, Claude updates the rule tree. UI shows before/after and the user confirms.

### 3.10 Cost controls

- Aggregator cache (15 min) reduces repeat token burn on the same date range
- Token budget per call: 4000 output tokens for suggest, 2000 for explain, 2000 for refine
- Daily budget guardrail: count AI requests per org per day, soft cap at 200 (configurable), owner notification at 80%
- Every AI call logs to `ai_requests` table: user, endpoint, token counts, cost estimate, timestamp

**File:** `src/lib/db/schema.ts` addition:

```ts
export const aiRequests = pgTable('ai_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costEstimateCents: integer('cost_estimate_cents'),
  requestedAt: timestamp('requested_at').defaultNow(),
});
```

### 3.11 UI

Segments page gets three new surfaces:

**"AI Suggest" button** — opens a side panel:

```
┌─────────────────────────────────────────────────┐
│ AI Segment Suggestions                    [×]   │
├─────────────────────────────────────────────────┤
│ Based on data from: [Last 90 days ▾]           │
│ Optional goal: [____________________] [Analyze] │
├─────────────────────────────────────────────────┤
│ Suggestion 1 of 4                               │
│ Lapsed CULT members with high LTV               │
│ ─────────                                        │
│ 47 customers · 3.2% of base                     │
│ Rationale: These 47 members had >$1500 LTV      │
│ before pausing their CULT membership. Likely    │
│ to respond to a personal outreach.              │
│                                                  │
│ Suggested action:                                │
│ · Channel: email                                │
│ · Type: reactivation                            │
│ · Angle: "We'd love to have you back"          │
│                                                  │
│ Risk: 12 of these have open support issues.    │
│ Review before sending.                          │
│                                                  │
│ Rules (click to customize):                    │
│ ├─ tag includes: member-cult                   │
│ ├─ membership_status: paused                   │
│ └─ lifetime_value > 1500                       │
│                                                  │
│ [Create segment] [Refine] [Dismiss] [Next →]   │
└─────────────────────────────────────────────────┘
```

**"Why this segment?" on segment detail** — modal with explanation and refinement suggestions.

**"Refine" button** — text input, user describes the change in natural language, Claude returns modified rules with diff preview.

### 3.12 Klaviyo sync

Segment membership syncs to Klaviyo as a list. Done via:

1. Create segment in CRM → create matching list in Klaviyo via `POST /api/lists`
2. Evaluate segment → push member emails to list via `POST /api/lists/{id}/relationships/profiles`
3. Hourly re-evaluation → diff members → push adds/removes
4. Audit log for each sync

Klaviyo sync requires `org:segments:sync_klaviyo` permission.

### 3.13 Done criteria — AI segmentation

- [ ] Rule builder supports all 19 field categories from §3.2
- [ ] Rule compiler translates nested AND/OR to SQL against projection
- [ ] Aggregator produces 15-min cached anonymous stats
- [ ] AI Suggest endpoint (Sonnet 4.6, 4000 token cap)
- [ ] AI Explain endpoint with refinement suggestions
- [ ] AI Refine endpoint with conversational updates
- [ ] PII never sent to Claude (aggregates only, test covers this)
- [ ] `ai_requests` cost tracking table with daily budget guardrail
- [ ] Suggestion cards with create/refine/dismiss
- [ ] "Why this segment?" modal on detail
- [ ] Klaviyo list sync with hourly diff push
- [ ] JSON validation of Claude output before use (reject malformed rule trees)

---

## 4. Client profile data model — completeness pass

### 4.1 Why this section

The brief lists 9 capabilities. Tracing each to what's already built:

| Brief requirement | Covered by | Gap |
|---|---|---|
| Contact fields: full name, addresses, phone, email, birthdays, anniversaries | CRM spec §5.1, partial in client profile | Anniversaries not in UI |
| Customer metadata / custom fields (freeform tags, notes) | CRM spec §5.2, partial | Freeform custom fields not exposed beyond structured metafields |
| Shopify-linked purchase history | Projection tables | UI showing product images, SKUs, sizes not spec'd |
| Return history / return rates per customer | CRM spec §5.4 | No UI |
| Customer tagging & classification | CRM spec §5.3 | Partial in profile |
| Segmentation & filtering rules | §3 of this doc | Covered |
| Simple, tailored UI for a luxury brand | Design system | Ongoing |
| Audit trail / interaction history | CRM spec §14 | No build spec |
| Import/export & sync capabilities | CRM admin spec §1.2 | Partial |
| Reporting & exports | CRM admin spec | Partial |

This section closes the listed gaps.

### 4.2 Client profile — complete layout

Three-column layout from CRM spec §12 formalized as a build spec.

**File:** `src/app/crm/clients/[id]/page.tsx` — server component
**File:** `src/app/crm/clients/[id]/ClientProfileClient.tsx` — client

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Clients   Marie Dubois · she/her                    [Actions menu ▾]   │
├──────────────┬─────────────────────────────────────┬─────────────────────┤
│              │                                     │                     │
│   IDENTITY   │           ACTIVITY                  │   CONTEXT           │
│   (sticky)   │           (scrollable)              │   (collapsible)     │
│              │                                     │                     │
│ [avatar]     │  [Filter chips: All, Orders, Notes, │  Fit profile        │
│ Marie Dubois │   Calls, Emails, Try-ons, Visits]   │  ▸                  │
│ she/her      │                                     │                     │
│              │  Apr 15 · Try-on session (4 frames) │  Preferences        │
│ 🏷 CULT      │  ▸                                  │  ▸ Stated           │
│ $247 credits │                                     │  ▸ Derived          │
│              │  Apr 08 · Order #1284 · $385       │                     │
│ 📧 marie@... │  ▸ 1 item · Senna Black             │  Recent orders (3) │
│   [consent]  │                                     │  ▸                  │
│ 📱 514-***   │  Mar 22 · Note by Emma              │                     │
│   [consent]  │  "Prefers lighter acetate..."       │  Try-on history    │
│              │                                     │  ▸                  │
│ 🎂 Mar 15    │  Mar 10 · Email sent                │                     │
│ 💍 Jul 22    │  "CULT March credit deposited"      │  Second Sight      │
│              │                                     │  ▸                  │
│ 🏠 Plateau   │  ... (infinite scroll)              │                     │
│              │                                     │  Custom designs     │
│ LTV $2,840   │                                     │  ▸                  │
│ Orders: 6    │                                     │                     │
│ Returns: 8%  │                                     │  Related clients    │
│              │                                     │  ▸                  │
│ Tags         │                                     │                     │
│ [high-ltv]   │                                     │  Internal notes     │
│ [collector]  │                                     │  ▸                  │
│              │                                     │                     │
└──────────────┴─────────────────────────────────────┴─────────────────────┘
```

### 4.3 Identity column details

All fields editable inline. Permission checks shown.

| Field | Source | Permission | Notes |
|---|---|---|---|
| Avatar | metafield custom.avatar_url | org:clients:update | Upload to R2 |
| Name | Shopify native | org:clients:update | |
| Pronouns | metafield custom.pronouns | org:clients:update | |
| Tier badge | tag prefix `member-` | org:membership:read | |
| Credits balance | sum of credits_ledger | org:credits:read | |
| Primary email | Shopify native | org:clients:update | |
| Email consent toggle | Shopify emailMarketingConsent | org:consent:update | Audits with confirmation modal |
| Phone | Shopify native | org:clients:update | Normalized to E.164 |
| SMS consent toggle | metafield custom.marketing_consent_sms | org:consent:update | |
| Birthday | metafield custom.birthday | org:clients:update | |
| Anniversary | metafield custom.anniversary | org:clients:update | |
| Home location | metafield custom.home_location | org:clients:update | Dropdown from locations |
| LTV | aggregated from orders_projection | org:orders:read | Live |
| Order count | aggregated | org:orders:read | |
| Return rate | returned_line_items / total_line_items | org:orders:read | % + absolute |
| Tags | customer_tags_projection | org:tags:apply (apply only) | Can remove without manage_taxonomy |

### 4.4 Consent toggles

Three toggles visible: Email, SMS, Do Not Contact.

Each toggle requires confirmation:

```
┌─────────────────────────────────────────────┐
│ Change email consent?                       │
├─────────────────────────────────────────────┤
│ Marie will no longer receive marketing      │
│ emails. Transactional emails (order         │
│ confirmations, shipping) still send.        │
│                                             │
│ Reason (optional):                          │
│ [_________________________________________] │
│                                             │
│ Source of this change:                      │
│ ○ Client requested verbally                 │
│ ○ Client requested by email                 │
│ ● Staff decision                            │
│                                             │
│                    [Cancel] [Confirm change]│
└─────────────────────────────────────────────┘
```

Writes to Shopify, fires Klaviyo subscription update, audits with source + reason + staffId.

### 4.5 Activity timeline (centre column)

**File:** `src/app/api/crm/clients/[id]/timeline/route.ts`

```
GET /api/crm/clients/[id]/timeline
Auth: org:interactions:read
Query: filter[], limit, cursor
Returns: combined feed from:
  - interactions table (notes, calls, visits)
  - orders_projection (purchases with line items)
  - returns_projection (returns)
  - product_interactions (try-ons, recs)
  - credits_ledger (credit events)
  - appointments (past appointments)
  - email/SMS events from Klaviyo (synced via webhooks)
  - Rx updates (from metafield change events)
```

Entry types rendered:

| Type | Icon | Actions |
|---|---|---|
| Note | 📝 | Edit (within 24h), delete |
| Call | 📞 | Edit |
| In-store visit | 🏪 | Edit |
| Order | 🛍️ | View order, view products |
| Return | ↩️ | View reason |
| Try-on session | 👓 | View frames tried, outcomes |
| Product recommended | ✨ | View product |
| Email sent | ✉️ | View subject, Klaviyo metrics (opened/clicked) |
| Email opened | 👁️ | — |
| Email clicked | 🔗 | View URL |
| SMS sent | 💬 | View body |
| Campaign sent | 📣 | View campaign |
| Appointment | 📅 | View details |
| Credit issued | 💰 | View ledger entry |
| Credit redeemed | 💳 | View order |
| Rx updated | 👁️‍🗨️ | View Rx |
| Preferences updated | ❤️ | View diff |
| Tag added/removed | 🏷️ | — |

Filter chips at top of timeline: All · Orders · Notes · Calls · Visits · Try-ons · Emails · SMS · Credits · Appointments. Multi-select.

### 4.6 Purchase history with product context

When rendering an order entry:

```
┌─────────────────────────────────────────────────────┐
│ 🛍️ Order #1284 · Apr 08 · Plateau · $385            │
│ ─────────                                            │
│ [img] Senna · Black · Clear lenses                  │
│       SKU: LNT-SEN-BLK-CLR · Size: Large            │
│       $285                                           │
│                                                      │
│ [img] Microfiber cloth · $15                        │
│                                                      │
│ Subtotal $300 · Shipping $10 · Tax $75              │
│                                                      │
│ [View order] [View invoice] [Process return]       │
└─────────────────────────────────────────────────────┘
```

Product image pulled from `products_projection.images[0]`. Clicking product → PDP at `/crm/products/[id]`.

### 4.7 Returns and return rate

Return rate calculation:

```sql
SELECT
  COUNT(DISTINCT CASE WHEN li.returned = true THEN li.id END)::float /
  NULLIF(COUNT(DISTINCT li.id), 0) AS return_rate
FROM orders_projection o
JOIN line_items_projection li ON li.order_id = o.shopify_order_id
WHERE o.customer_id = $1
```

Displayed in identity column as percentage. Click → opens returns history sheet with reason codes.

### 4.8 Custom fields (freeform)

Beyond the structured metafields (face_shape, frame_width_mm, etc.) there's a "Custom fields" section in the context column:

```
Custom fields
─────────
wedding-season-2026   "Daughter's wedding, needs dress frames"
favourite-sa          Emma
preferred-language    French
                                              [+ Add field]
```

Stored in `metafields.custom.custom_fields` as `Array<{ key, value, addedBy, addedAt }>`. No schema constraint — staff create keys as needed. Suggestion matching on key creation (like tags) to prevent sprawl.

Permission: `org:clients:update`.

### 4.9 Interaction logging

**File:** `src/components/crm/LogInteractionModal.tsx`

Invoked from "+ Add interaction" button in timeline header.

Form:
- Type (note, call, in-store visit, email summary, SMS summary)
- Title (optional)
- Body (rich text, keyboard shortcuts for bold/italic/link)
- Related order (optional, dropdown of recent orders)
- Related product (optional, product picker)
- Location (auto-filled from staff's primary, editable)
- Visibility (default: all staff; optional: owner-only for sensitive notes)
- [Save interaction]

Write to `interactions` table. Fires timeline refresh.

### 4.10 Export

**Single client export:**

```
GET /api/crm/clients/[id]/export
Auth: org:clients:export_single
Query: format=json|csv|pdf
```

JSON: all data. CSV: flat attributes + separate CSVs for timeline/orders/interactions (ZIP). PDF: human-readable profile summary.

**Bulk export:**

```
GET /api/crm/clients/export
Auth: org:clients:export_bulk
Query: segmentId?, tagIncludes?, format=csv
```

Streams CSV. Large exports (>10k rows) run async via Inngest, email link when ready.

### 4.11 Reports

**File:** `src/app/crm/reports/page.tsx` — server component

Pre-built reports:

| Report | Permission |
|---|---|
| Customer LTV cohorts | org:reports:read |
| Return rate by product | org:reports:read |
| Return rate by customer segment | org:reports:read |
| Try-on to purchase funnel | org:reports:read |
| Staff activity (interactions, recs, sales) | org:reports:read |
| Cross-location comparison | org:reports:cross_location |
| Consent opt-in trend | org:reports:read |
| AI request cost | org:reports:read |

Each report: date range filter, location filter (respects scope), export CSV, shareable link.

### 4.12 Done criteria — Client profile completeness

- [ ] Three-column layout with sticky identity column
- [ ] All contact fields editable inline (name, pronouns, birthday, anniversary, home location)
- [ ] Consent toggles (email, SMS, DNC) with confirmation + source + audit
- [ ] Activity timeline combines 14+ entry types, filterable
- [ ] Purchase history shows product image, SKU, size, variant details
- [ ] Return rate calculated and displayed in identity column
- [ ] Returns history sheet accessible from LTV
- [ ] Custom fields section with freeform key/value + sprawl prevention
- [ ] Interaction logging modal (5 types, rich text)
- [ ] Single client export (JSON, CSV ZIP, PDF)
- [ ] Bulk export streaming CSV with async email for large jobs
- [ ] Reports page with 8 pre-built reports

---

## 5. Implementation order

Kiro-friendly: these are in a sensible build order, each phase leaves the app runnable.

### Phase A — Foundation (1-2 weeks)

1. Clerk seeding script (§1.3)
2. All permission keys in Clerk (§1.4)
3. Role-permission matrix assigned (§1.5)
4. Permission helpers (server + client, §1.10)
5. Location scope helper (§1.8)
6. Surface header middleware (§1.9)
7. Audit log completeness pass (§1.14)

### Phase B — Staff lifecycle (1 week)

1. Invite API with role validation (§1.11)
2. Update role / locations API
3. Suspend / reinstate
4. Offboard with activity PDF
5. Staff management UI (§1.12)
6. Permissions inspector modal
7. Audit viewer

### Phase C — Client profile completeness (1-2 weeks)

1. Three-column layout
2. Consent toggles with audit
3. Activity timeline API + UI (§4.5)
4. Custom fields section
5. Returns rate + history
6. Interaction logging modal
7. Export APIs (single + bulk)

### Phase D — Recommendations + try-on (3-4 weeks)

1. New tables (`product_interactions`, `product_feedback`, `try_on_sessions`)
2. Product search API with scoring (§2.4)
3. Score function + unit tests
4. Product detail enhancements (inventory by location, heatmap)
5. Try-on engine abstraction + MediaPipe implementation
6. `/crm/tryon` page (§2.7)
7. Try-on APIs
8. Klaviyo event integration
9. Client profile try-on history panel
10. Recommendations analytics page

### Phase E — AI segmentation (1-2 weeks)

1. Rule compiler with expanded fields (§3.3)
2. Aggregator with Redis caching (§3.5)
3. Claude integration layer (§3.6)
4. AI Suggest endpoint (§3.7)
5. AI Explain endpoint (§3.8)
6. AI Refine endpoint (§3.9)
7. Cost tracking + budget guardrail
8. UI: AI Suggest panel, Why this segment modal, Refine input
9. Klaviyo list sync

### Phase F — Reports + polish (1 week)

1. Reports page with 8 pre-built reports
2. Cross-location comparison view
3. CSV export streaming
4. Async job email delivery

**Total rough estimate:** 8-12 weeks of focused build, assuming one developer. Try-on adds the most uncertainty — if 3D assets aren't available, that phase stalls.

---

## 6. Things I'm explicitly not covering here

Flagged so they don't get forgotten:

- **Custom designs module** — needs its own spec (§18 in CRM spec has the shape)
- **Second Sight intake UI** — needs its own spec (§15 in CRM spec)
- **Messaging composition UI** (§10 in CRM spec) — V2 feature, compose-and-send from CRM
- **Admin business configuration** — tier pricing, Second Sight multipliers, appointment types, covered in CRM admin spec §5
- **Storefront account page** — customer-facing, reads from same projection, separate frontend spec
- **Mobile app (tablet + phone)** — Expo + WatermelonDB build, own spec
- **Integration health dashboard** (CRM admin spec §6) — V2
- **Customer data requests** (privacy, Law 25) — CRM admin spec §7
- **Tag taxonomy governance UI** — CRM admin spec §4

Suggest building specs 08 through 13 for these in the same format.

---

## 7. Open decisions requiring Benjamin's input

| # | Decision | Recommendation |
|---|---|---|
| 1 | Try-on engine for V1 | MediaPipe (free). Upgrade to Jeeliz only if demo-quality is a problem at scale. |
| 2 | 3D asset sourcing | Ask manufacturers for GLB files first. For models they can't supply, budget $100-200 per frame for scanning. Only frames tagged `tryOnReady` get try-on. |
| 3 | AI suggestion budget | Daily soft cap 200 calls/org. $20/day at current Sonnet 4.6 pricing. |
| 4 | Consent change source capture | Proposed 3 sources (verbal, email, staff). Keep it at three — more granularity adds friction. |
| 5 | Custom fields governance | Start freeform with suggestion matching. Add governance (approved key list) if sprawl becomes real. |
| 6 | Try-on storage retention | Screenshots: 90 days default, 2 years if customer opts to save. Clarify with privacy policy. |

---

*Cross-reference: CRM spec §1-23 · Clerk permissions doc · Existing specs 01-06 (this supersedes 02, 05, 06)*
