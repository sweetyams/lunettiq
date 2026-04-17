# Lunettiq — Clerk Roles & Permissions Configuration

**Target:** Clerk Organizations (B2B model)
**Organization type:** One organization per Lunettiq brand (not per location — locations are data scope, not org scope)
**Convention:** `org:<feature>:<action>`
**Last updated:** April 2026

---

## Setup approach

1. In Clerk Dashboard, enable **Organizations**.
2. Create one organization: `lunettiq`.
3. Under **Organization Settings → Roles**, create the five roles below.
4. Under **Organization Settings → Permissions**, create the permissions below.
5. Assign permissions to roles via the role editor.
6. Location scoping (which store a user works at) is **not** a Clerk permission — it's public metadata on the membership. See [Section 4](#4-location-scoping-via-public-metadata).

---

## 1. Roles

Create these five roles in Clerk:

| Role key | Display name | Description |
|---|---|---|
| `org:owner` | Owner | Full access across all locations. Benjamin. |
| `org:manager` | Store Manager | Runs one or more locations. Manages staff within scope. |
| `org:optician` | Optician | Prescriptions, lens selection, eye exam records. Read-only on commercial data. |
| `org:sales_associate` | Sales Associate | Client-facing work at assigned location. No bulk operations. |
| `org:read_only` | Read-Only | View-only access for accountants, external agency, audit. |

> Clerk requires `org:admin` and `org:member` system roles. Map `org:owner` to the admin tier and the rest to member-level roles, with permissions doing the actual gating.

---

## 2. Permissions

Create each permission in Clerk Dashboard. Copy the **key** exactly (it's what your app code will check against).

### 2.1 Clients

| Permission key | Description |
|---|---|
| `org:clients:read` | View client profiles |
| `org:clients:create` | Create new clients |
| `org:clients:update` | Edit client fields (name, contact, address, tags) |
| `org:clients:delete` | Soft delete a client |
| `org:clients:merge` | Merge duplicate clients |
| `org:clients:export_single` | Export one client's data |
| `org:clients:export_bulk` | Export multiple clients (segments, lists) |

### 2.2 Rx / Medical

Scoped separately because opticians need these and other roles generally don't.

| Permission key | Description |
|---|---|
| `org:rx:read` | View Rx status, last updated, prescription files |
| `org:rx:update` | Edit Rx fields and upload new prescription files |
| `org:rx:delete` | Remove prescription files |
| `org:fit_profile:read` | View face shape and fit measurements |
| `org:fit_profile:update` | Edit fit measurements |

### 2.3 Preferences

| Permission key | Description |
|---|---|
| `org:preferences:read` | View stated and derived preferences |
| `org:preferences:update` | Edit stated preferences |

### 2.4 Tags

| Permission key | Description |
|---|---|
| `org:tags:apply` | Add/remove tags on individual clients |
| `org:tags:bulk_apply` | Bulk tag operations on segments |
| `org:tags:manage_taxonomy` | Create, rename, retire tags in settings |

### 2.5 Interactions (timeline)

| Permission key | Description |
|---|---|
| `org:interactions:read` | View client interaction timeline |
| `org:interactions:create` | Add notes, call logs, in-store visits |
| `org:interactions:update` | Edit own interactions within 24h window |
| `org:interactions:delete` | Delete own interactions (soft) |

### 2.6 Orders (Shopify, read-only in CRM)

| Permission key | Description |
|---|---|
| `org:orders:read` | View orders on client profile |
| `org:orders:read_all` | Cross-client order browsing |

### 2.7 Products / Catalogue

| Permission key | Description |
|---|---|
| `org:products:read` | Browse product catalogue |
| `org:products:read_sales_history` | View sales history per product |
| `org:products:recommend` | Recommend a product to a client (timeline entry + link) |

### 2.8 Segments

| Permission key | Description |
|---|---|
| `org:segments:read` | View segments |
| `org:segments:create` | Create new segments |
| `org:segments:update` | Edit segments |
| `org:segments:delete` | Delete segments |
| `org:segments:sync_klaviyo` | Push segment to Klaviyo as a list |

### 2.9 Second Sight

| Permission key | Description |
|---|---|
| `org:second_sight:read` | View intakes and queue |
| `org:second_sight:create` | Start new intake |
| `org:second_sight:update` | Edit intake details |
| `org:second_sight:approve_grade` | Approve grade transitions affecting credit value |
| `org:second_sight:list_shopify` | Create Shopify product listing from intake |

### 2.10 Custom Designs

| Permission key | Description |
|---|---|
| `org:custom_designs:read` | View design queue and details |
| `org:custom_designs:create` | Start new design draft |
| `org:custom_designs:update` | Edit design drafts and revisions |
| `org:custom_designs:submit_review` | Move design from draft to in_review |
| `org:custom_designs:approve` | Approve designs for production (owner only) |
| `org:custom_designs:update_production_status` | Mark production milestones (workshop role, V2) |

### 2.11 Appointments

| Permission key | Description |
|---|---|
| `org:appointments:read` | View appointments |
| `org:appointments:create` | Schedule appointments |
| `org:appointments:update` | Reschedule, cancel, add notes |
| `org:appointments:delete` | Remove appointments |

### 2.12 Membership & Credits

| Permission key | Description |
|---|---|
| `org:membership:read` | View tier and credits balance |
| `org:membership:update_tier` | Change tier (add/remove tier tag) |
| `org:membership:update_status` | Pause, cancel, reactivate |
| `org:credits:read` | View credits ledger |
| `org:credits:adjust` | Manually adjust credits balance (requires reason) |

### 2.13 Consent & Messaging

| Permission key | Description |
|---|---|
| `org:consent:read` | View consent state |
| `org:consent:update` | Toggle email/SMS consent on client profile |
| `org:campaigns:read` | View campaign list and performance |
| `org:campaigns:create` | Create campaign in Klaviyo |
| `org:messaging:send_direct` | Send one-off email or SMS to a client (V2) |

### 2.14 Reports

| Permission key | Description |
|---|---|
| `org:reports:read` | View pre-built reports |
| `org:reports:export` | Export report data as CSV |
| `org:reports:cross_location` | View cross-location comparison reports |

### 2.15 Audit

| Permission key | Description |
|---|---|
| `org:audit:read_own_location` | View audit log scoped to assigned location |
| `org:audit:read_all` | View full audit log |

### 2.16 Settings

| Permission key | Description |
|---|---|
| `org:settings:locations` | Manage locations |
| `org:settings:staff` | Invite, remove, reassign staff |
| `org:settings:tags` | Manage tag taxonomy |
| `org:settings:integrations` | Configure Shopify, Klaviyo, booking systems |
| `org:settings:consent_policy` | Configure consent defaults |

---

## 3. Role → Permission matrix

Copy this into Clerk by assigning each permission below to each role.

### 3.1 Owner (`org:owner`)

Gets everything. Easiest to assign is "all permissions."

```
org:clients:*
org:rx:*
org:fit_profile:*
org:preferences:*
org:tags:*
org:interactions:*
org:orders:*
org:products:*
org:segments:*
org:second_sight:*
org:custom_designs:*
org:appointments:*
org:membership:*
org:credits:*
org:consent:*
org:campaigns:*
org:messaging:*
org:reports:*
org:audit:read_all
org:settings:*
```

### 3.2 Store Manager (`org:manager`)

Full operations within their location scope. No org-level settings except audit for their location.

```
org:clients:read
org:clients:create
org:clients:update
org:clients:merge
org:clients:export_single
org:clients:export_bulk

org:rx:read
org:fit_profile:read
org:fit_profile:update

org:preferences:read
org:preferences:update

org:tags:apply
org:tags:bulk_apply

org:interactions:read
org:interactions:create
org:interactions:update
org:interactions:delete

org:orders:read
org:orders:read_all

org:products:read
org:products:read_sales_history
org:products:recommend

org:segments:read
org:segments:create
org:segments:update
org:segments:delete
org:segments:sync_klaviyo

org:second_sight:read
org:second_sight:create
org:second_sight:update
org:second_sight:approve_grade
org:second_sight:list_shopify

org:custom_designs:read
org:custom_designs:create
org:custom_designs:update
org:custom_designs:submit_review

org:appointments:read
org:appointments:create
org:appointments:update
org:appointments:delete

org:membership:read
org:membership:update_tier
org:membership:update_status
org:credits:read
org:credits:adjust

org:consent:read
org:consent:update

org:campaigns:read
org:campaigns:create
org:messaging:send_direct

org:reports:read
org:reports:export

org:audit:read_own_location
```

### 3.3 Optician (`org:optician`)

Rx-focused. Full medical data at all locations. Read-only on commercial, can log clinical interactions and appointments.

```
org:clients:read
org:clients:update

org:rx:read
org:rx:update
org:rx:delete

org:fit_profile:read
org:fit_profile:update

org:preferences:read

org:interactions:read
org:interactions:create
org:interactions:update
org:interactions:delete

org:orders:read

org:products:read

org:appointments:read
org:appointments:create
org:appointments:update

org:custom_designs:read
org:custom_designs:update

org:membership:read
org:credits:read

org:consent:read
```

> **Scope note:** Opticians operate across all locations (a client's Rx doesn't belong to a store). Don't restrict via location scope — unlike managers and SAs. Handle in app logic.

### 3.4 Sales Associate (`org:sales_associate`)

Client-facing work. Scoped to assigned location(s). No bulk operations, no approvals.

```
org:clients:read
org:clients:create
org:clients:update
org:clients:export_single

org:rx:read
org:fit_profile:read
org:fit_profile:update

org:preferences:read
org:preferences:update

org:tags:apply

org:interactions:read
org:interactions:create
org:interactions:update
org:interactions:delete

org:orders:read

org:products:read
org:products:recommend

org:segments:read
org:segments:create
org:segments:update

org:second_sight:read
org:second_sight:create
org:second_sight:update

org:custom_designs:read
org:custom_designs:create
org:custom_designs:update
org:custom_designs:submit_review

org:appointments:read
org:appointments:create
org:appointments:update

org:membership:read
org:credits:read

org:consent:read
org:consent:update
```

### 3.5 Read-Only (`org:read_only`)

For accountants, agencies, external auditors. View everything, modify nothing.

```
org:clients:read
org:clients:export_single
org:clients:export_bulk

org:rx:read
org:fit_profile:read

org:preferences:read

org:interactions:read

org:orders:read
org:orders:read_all

org:products:read
org:products:read_sales_history

org:segments:read

org:second_sight:read

org:custom_designs:read

org:appointments:read

org:membership:read
org:credits:read

org:consent:read

org:campaigns:read

org:reports:read
org:reports:export
org:reports:cross_location
```

---

## 4. Location scoping via public metadata

Clerk permissions don't handle "this user can only see Plateau data." That's a data-scope concern, not a feature-scope concern. Handle it this way:

### 4.1 Store on the membership

When a user joins the organization, set `publicMetadata` on their `OrganizationMembership`:

```json
{
  "location_ids": ["plateau"],
  "primary_location_id": "plateau",
  "can_view_all_locations": false
}
```

For Benjamin (owner):
```json
{
  "location_ids": ["plateau", "dix30", "mile-end"],
  "primary_location_id": "plateau",
  "can_view_all_locations": true
}
```

For a manager running two locations:
```json
{
  "location_ids": ["plateau", "mile-end"],
  "primary_location_id": "plateau",
  "can_view_all_locations": false
}
```

### 4.2 Enforce in app code

Every CRM API request that touches location-scoped data reads the membership metadata and applies a `WHERE location_id IN (...)` filter. Owners and opticians bypass this filter. SAs and managers don't.

```ts
// Simplified example
const { has, orgPermissions, publicMetadata } = await auth();

const canViewAll = publicMetadata.can_view_all_locations === true;
const allowedLocations = publicMetadata.location_ids;

const query = db.select().from(interactions);
if (!canViewAll) {
  query.where(inArray(interactions.location_id, allowedLocations));
}
```

### 4.3 Why not a permission

Location scope varies per user, not per role. A manager at Plateau has the same permissions as a manager at DIX30 — the only difference is which location. Putting that in the permission string (`org:clients:read:plateau`) creates a combinatorial explosion. Metadata handles it cleanly.

---

## 5. How your app checks permissions

Clerk exposes permissions via the `has()` helper on the session:

```ts
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const { has } = await auth();

  if (!has({ permission: 'org:custom_designs:approve' })) {
    return new Response('Forbidden', { status: 403 });
  }

  // ... approve the design
}
```

For multi-permission checks, build a helper:

```ts
// lib/permissions.ts
export function canManageLocation(has, locationId, userMetadata) {
  if (userMetadata.can_view_all_locations) return true;
  return userMetadata.location_ids.includes(locationId);
}
```

---

## 6. Roles to add later (don't create in V1)

Create these in Clerk when you hire for the role or contract the partner. Pre-defined here so the permission set is ready.

### 6.1 Stylist / Senior SA (`org:stylist`)
Inherits SA permissions, plus:
```
org:tags:bulk_apply
org:second_sight:approve_grade
org:messaging:send_direct
```

### 6.2 Production / Workshop (`org:production`)
Very narrow. Only for V2 when custom frames run at volume:
```
org:custom_designs:read
org:custom_designs:update_production_status
org:clients:read       (name + contact only, app-enforced)
org:rx:read            (for production brief, app-enforced scope)
```

### 6.3 Marketing (`org:marketing`)
For in-house marketing hire or agency:
```
org:clients:read
org:segments:*
org:campaigns:*
org:messaging:send_direct
org:reports:read
org:reports:export
org:products:read
org:preferences:read
org:consent:read
```
> No access to Rx, fit profile, custom designs, credits adjustments.

### 6.4 External / Partner (`org:partner`)
For wholesale or press:
```
org:products:read
org:clients:read (specific segments only, app-enforced)
```

---

## 7. Auth flow specifics

### 7.1 Invitation flow

Owners invite staff via Clerk's Organization invitation:
1. Owner goes to `/settings/staff` in the CRM
2. Enters email + role + assigned locations
3. CRM API calls `clerkClient.organizations.createOrganizationInvitation()` with role + location metadata
4. Clerk sends invitation email
5. User accepts, sets password or uses SSO, lands on their default page

### 7.2 MFA requirements

Enforce MFA for these roles in Clerk's Session settings:
- `org:owner` — required
- `org:manager` — required
- `org:optician` — required (medical data)
- `org:sales_associate` — optional
- `org:read_only` — optional

Configure under **User & Authentication → Multi-factor**.

### 7.3 Session lengths

- Web: 7 days idle
- Mobile (tablet and phone): 14 days idle with biometric unlock

Configure per-domain in Clerk's Session settings.

### 7.4 Surface identification

When making API requests, the mobile apps and web app send a `X-CRM-Surface` header (`web`, `tablet`, `phone`). The CRM API writes this to the audit log alongside the Clerk user ID. Not a Clerk feature — application-level.

---

## 8. Summary: minimum setup for V1 launch

Do this, in order:

1. Enable Clerk Organizations
2. Create the `lunettiq` organization
3. Create 5 roles: `org:owner`, `org:manager`, `org:optician`, `org:sales_associate`, `org:read_only`
4. Create all permissions listed in [Section 2](#2-permissions)
5. Assign permissions to each role per [Section 3](#3-role--permission-matrix)
6. Configure MFA requirements per [Section 7.2](#72-mfa-requirements)
7. Configure session lengths per [Section 7.3](#73-session-lengths)
8. Build the `location_ids` membership metadata flow in your app's staff invitation UI

Everything else (stylist, production, marketing, partner) is V2+. The permissions for those are pre-defined here but don't create the roles in Clerk until you actually onboard someone into them.

---

*Cross-reference: CRM spec `lunettiq-crm-spec.md` · Section 9 (Shared authentication), Section 21 (Permissions and audit)*
