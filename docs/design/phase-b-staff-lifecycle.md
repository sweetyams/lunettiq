# Phase B — Staff Lifecycle: Design

**Status:** DRAFT
**Prereq:** Phase A complete (auth, permissions, audit)

---

## D-010: Invite API hardening (REQ-B-001)

**File:** `src/app/api/crm/staff/invite/route.ts` — rewrite

Existing route works but lacks validation. Changes:

1. Validate `role` against `CRM_ROLES` (import `isValidRole`)
2. Validate `locationIds` is non-empty array
3. Validate `primaryLocationId` is in `locationIds`
4. If role is `owner` or `manager`, verify inviter is `owner` (check `session.role`)
5. Set `public_metadata` on invitation: `{ role, location_ids, primary_location_id }`
6. Use `writeAudit` helper instead of raw insert

No structural change — same endpoint, same Clerk API call.

---

## D-011: Revoke invitation route (REQ-B-003)

**File:** `src/app/api/crm/staff/invitations/[id]/route.ts` — new

```
DELETE /api/crm/staff/invitations/[id]
Auth: org:settings:staff
```

Calls Clerk `POST /v1/invitations/{id}/revoke`. Audit log on success.

This is the missing route that caused the 404.

---

## D-012: Staff PATCH — role & location editing (REQ-B-004, REQ-B-005)

**File:** `src/app/api/crm/staff/[id]/route.ts` — modify

Existing route already merges metadata correctly. Add:

1. If `body.role` provided: validate against `CRM_ROLES`
2. If promoting to `owner`: verify `session.role === 'owner'`
3. If demoting from `owner`: verify at least one other owner exists (query Clerk users, check metadata)
4. If `body.locationIds` provided: validate `primaryLocationId` is in `locationIds`
5. If `body.bypassLocationScope` is true: verify `session.role === 'owner'`

The confirmation modal is client-side only (D-017).

---

## D-013: Suspend/reinstate — no changes needed (REQ-B-006, REQ-B-007)

**File:** `src/app/api/crm/staff/[id]/suspend/route.ts` — keep as-is

Existing route is correct. Only change: use `writeAudit` helper instead of raw insert, and accept optional `reason` field in body.

---

## D-014: Offboard — two-step + metadata merge (REQ-B-008)

**File:** `src/app/api/crm/staff/[id]/offboard/route.ts` — rewrite

Two endpoints:

```
GET /api/crm/staff/[id]/offboard
Auth: org:settings:staff
Returns: { appointmentCount, intakeCount, designCount } — impact preview for step 1
```

```
POST /api/crm/staff/[id]/offboard
Auth: org:settings:staff
Body: { confirmName: string }
```

POST changes from existing:
1. Validate `confirmName` matches user's full name (fetch from Clerk)
2. Reassign appointments, intakes, custom designs (existing logic — keep)
3. Ban user via Clerk
4. **Merge** metadata instead of overwriting: fetch existing, spread, add offboard fields
5. Audit log with reassignment counts

---

## D-015: Invitations GET — already works (REQ-B-002)

**File:** `src/app/api/crm/staff/invitations/route.ts` — keep as-is

Already fetches pending invitations from Clerk. No changes needed.

---

## D-016: Staff list page — server component (REQ-B-009)

**File:** `src/app/crm/settings/staff/page.tsx` — keep existing

Already fetches users from Clerk, maps metadata, passes to client component. Auth check added in Phase A. No changes needed.

---

## D-017: Staff management client — actions (REQ-B-009, REQ-B-010)

**File:** `src/app/crm/settings/staff/StaffManagementClient.tsx` — modify

Add/fix these UI elements:

1. **Role edit confirmation modal** — on role change, show "Change [name] from [old] to [new]?" before calling PATCH
2. **Location edit modal** — multi-select location checkboxes + primary location dropdown, calls PATCH
3. **Offboard two-step modal**:
   - Step 1: fetch GET `/api/crm/staff/[id]/offboard`, show impact counts
   - Step 2: type name to confirm, calls POST
4. **Revoke button** on pending invitations — calls DELETE `/api/crm/staff/invitations/[id]`
5. Gate all actions behind `usePermission` hooks from Phase A

---

## Files changed summary

| File | Action | REQs |
|---|---|---|
| `src/app/api/crm/staff/invite/route.ts` | Rewrite | B-001 |
| `src/app/api/crm/staff/invitations/[id]/route.ts` | New | B-003 |
| `src/app/api/crm/staff/[id]/route.ts` | Modify | B-004, B-005 |
| `src/app/api/crm/staff/[id]/suspend/route.ts` | Minor | B-006, B-007 |
| `src/app/api/crm/staff/[id]/offboard/route.ts` | Rewrite | B-008 |
| `src/app/crm/settings/staff/StaffManagementClient.tsx` | Modify | B-009, B-010 |

No new tables. No schema changes. All routes use existing Clerk API patterns.
