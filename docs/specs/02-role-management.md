# Spec 02: Role Management + Staff Lifecycle

**Status:** APPROVED
**Dependencies:** None (standalone)
**Permissions used:** org:settings:staff (owner + manager only)

---

## What exists today

### Files
- `src/app/crm/settings/staff/page.tsx` — Client component, read-only table. Fetches from `/api/crm/staff`. Shows name, email, role, locations.
- `src/app/api/crm/staff/route.ts` — GET: fetches all users from Clerk API, maps publicMetadata to role/locationIds. Gated on `org:settings:staff`.
- `src/lib/crm/permissions.ts` — 5 roles: owner, manager, optician, sa, read_only. Full permission matrix.
- `src/lib/crm/auth.ts` — `requireCrmAuth(permission?)`, reads role from Clerk publicMetadata.

### Clerk user publicMetadata shape (current)
```json
{
  "role": "owner",
  "location_ids": ["loc_plateau", "loc_dix30"],
  "can_view_all_locations": true
}
```

### Locations (hardcoded in staff page)
```ts
const LOCATIONS: Record<string, string> = {
  loc_plateau: 'Plateau',
  loc_dix30: 'Dix30',
};
```

---

## What to build

### 1. Staff invite API

**File:** `src/app/api/crm/staff/invite/route.ts`

```
POST /api/crm/staff/invite
Auth: org:settings:staff
Body: { email, role, locationIds }
```

Calls Clerk API to create an invitation:
- `POST https://api.clerk.com/v1/invitations` with `{ email_address, public_metadata: { role, location_ids } }`
- Returns invitation object
- Logs to audit_log: action=create, entityType=staff_invitation

### 2. Staff update API (role + locations)

**File:** `src/app/api/crm/staff/[id]/route.ts`

```
PATCH /api/crm/staff/[id]
Auth: org:settings:staff
Body: { role?, locationIds?, canViewAllLocations? }
```

Calls Clerk API:
- `PATCH https://api.clerk.com/v1/users/[id]` with `{ public_metadata: { role, location_ids, can_view_all_locations } }`
- Audit log with before/after diff

### 3. Staff suspend API

**File:** `src/app/api/crm/staff/[id]/suspend/route.ts`

```
POST /api/crm/staff/[id]/suspend
Auth: org:settings:staff
Body: { action: 'suspend' | 'reinstate' }
```

Calls Clerk API:
- Suspend: `POST https://api.clerk.com/v1/users/[id]/ban`
- Reinstate: `POST https://api.clerk.com/v1/users/[id]/unban`
- Audit log

### 4. Staff offboard API

**File:** `src/app/api/crm/staff/[id]/offboard/route.ts`

```
POST /api/crm/staff/[id]/offboard
Auth: org:settings:staff
```

Steps:
1. Reassign open appointments (staffId = this user, status in scheduled/confirmed) → set staffId to null
2. Reassign open intakes (staffId = this user, status in draft/submitted) → set staffId to null
3. Disable Clerk user: `POST https://api.clerk.com/v1/users/[id]/ban`
4. Mark in publicMetadata: `{ offboarded: true, offboarded_at: ISO }`
5. Audit log with summary of reassigned items

### 5. Pending invitations API

**File:** `src/app/api/crm/staff/invitations/route.ts`

```
GET /api/crm/staff/invitations
Auth: org:settings:staff
```

Fetches from Clerk: `GET https://api.clerk.com/v1/invitations?status=pending`

```
DELETE /api/crm/staff/invitations/[id]
Auth: org:settings:staff
```

Revokes: `POST https://api.clerk.com/v1/invitations/[id]/revoke`

### 6. Staff settings page (server component)

**File:** `src/app/crm/settings/staff/page.tsx` (rewrite)

Server component that:
1. Fetches staff list from Clerk
2. Fetches pending invitations from Clerk
3. Passes to StaffManagementClient

### 7. StaffManagementClient

**File:** `src/app/crm/settings/staff/StaffManagementClient.tsx`

```
Props:
  staff: StaffMember[]
  invitations: Invitation[]

State:
  roleFilter: string | null
  locationFilter: string | null
  inviteModal: boolean
  editingUser: string | null

Layout:
  ┌──────────────────────────────────────────────────────┐
  │ ← Settings    Staff                        [Invite]  │
  │ [All roles ▾] [All locations ▾]                      │
  ├──────────────────────────────────────────────────────┤
  │ Pending Invitations (if any)                         │
  │  email@example.com  •  manager  •  [Revoke]         │
  ├──────────────────────────────────────────────────────┤
  │ Name    Email    Role    Locations   Status  Actions │
  │ ...     ...      [pill]  [pills]     active  [···]  │
  └──────────────────────────────────────────────────────┘

Per-row actions dropdown:
  - Edit role → inline dropdown, confirm
  - Edit locations → inline multi-select, confirm
  - Suspend → confirm modal
  - Offboard → two-step confirm showing consequences
```

### Invite modal
```
Fields:
  - Email (text input, required)
  - Role (select: owner/manager/optician/sa/read_only)
  - Locations (multi-select checkboxes: Plateau, Dix30)
  - [Send Invitation] button

Submit: POST /api/crm/staff/invite → toast → refresh list
```

### Role edit (inline)
```
Click role pill on row → dropdown appears with 5 roles
Select new role → confirm modal: "Change [name] from [old] to [new]?"
Confirm → PATCH /api/crm/staff/[id] → toast → refresh
```

### Offboard confirm
```
Two-step modal:
  Step 1: "This will:" + list of consequences (X appointments reassigned, Y intakes unassigned)
  Step 2: Type staff member's name to confirm
  Submit → POST /api/crm/staff/[id]/offboard → toast → refresh
```

---

## Types

```ts
interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string | null;
  role: string;
  locationIds: string[];
  banned: boolean;
  offboarded: boolean;
}

interface Invitation {
  id: string;
  emailAddress: string;
  role: string;
  locationIds: string[];
  createdAt: string;
}
```

---

## Done criteria

- [ ] Staff table shows all Clerk users with role, locations, status
- [ ] Can filter by role and location
- [ ] Can invite new staff (email + role + locations) via Clerk API
- [ ] Pending invitations shown with revoke action
- [ ] Can edit role inline with confirmation
- [ ] Can edit locations inline
- [ ] Can suspend/reinstate staff
- [ ] Can offboard with two-step confirm + reassignment
- [ ] All actions audit logged
- [ ] TypeScript compiles clean

---

## Out of scope
- MFA management (handled by Clerk dashboard)
- Session management per user (Clerk dashboard)
- Bulk location reassignment (V2)
- Training mode per user (V2)
