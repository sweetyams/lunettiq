# Phase B — Staff Lifecycle: Requirements

**Status:** DRAFT — awaiting review
**Scope:** Staff invitation, role/location editing, suspend/reinstate, offboarding, staff management UI
**Sources:** Spec 07 §1.11–1.12, audit findings (2026-04-16)
**Depends on:** Phase A (auth, permissions, audit)

---

## Invitation

### REQ-B-001: Invite staff via Clerk
Owners and managers must be able to invite new staff members by email with a role and location assignment.

**Acceptance criteria:**
- POST endpoint accepts: email, role, locationIds, primaryLocationId
- Role must be one of the 5 canonical roles
- locationIds must be non-empty
- primaryLocationId must be in locationIds
- Only owners can invite owners or managers
- Invitation is created via Clerk Organizations API
- Location metadata is set on the invitation
- Audit log entry created with inviter, invitee email, role, locations

---

### REQ-B-002: View pending invitations
The staff management page must show pending invitations alongside active staff.

**Acceptance criteria:**
- Pending invitations fetched from Clerk API
- Each shows: email, role, invited date, invited by
- Visually distinct from active staff (e.g., "Pending" badge)

---

### REQ-B-003: Revoke pending invitation
Owners and managers must be able to cancel a pending invitation.

**Acceptance criteria:**
- DELETE endpoint revokes the invitation via Clerk API
- Invitation disappears from the list
- Audit log entry created

**Source:** Audit finding — revoke returned 404 (no route existed)

---

## Role & Location Management

### REQ-B-004: Edit staff role
Owners and managers must be able to change a staff member's role.

**Acceptance criteria:**
- PATCH endpoint accepts new role
- Confirmation required before applying (UI shows "Change [name] from [old] to [new]?")
- Only owners can promote to owner
- Demoting the last owner is blocked
- Clerk membership updated with new role in publicMetadata
- Audit log with before/after diff

**Source:** Audit finding — no confirmation modal existed

---

### REQ-B-005: Edit staff locations
Owners and managers must be able to change a staff member's assigned locations.

**Acceptance criteria:**
- PATCH endpoint accepts locationIds, primaryLocationId
- primaryLocationId must be in locationIds
- Clerk membership metadata updated
- Audit log with before/after diff

**Source:** Audit finding — location editing UI was completely missing

---

## Suspend & Reinstate

### REQ-B-006: Suspend staff
Owners and managers must be able to suspend a staff member, immediately revoking their access.

**Acceptance criteria:**
- POST endpoint calls Clerk banUser API
- All active sessions invalidated immediately
- Staff appears as "Suspended" in the management UI
- Audit log with reason (optional)

---

### REQ-B-007: Reinstate staff
Owners and managers must be able to reinstate a suspended staff member.

**Acceptance criteria:**
- POST endpoint calls Clerk unbanUser API
- Staff can sign in again
- Status returns to "Active" in the management UI
- Audit log entry created

---

## Offboarding

### REQ-B-008: Offboard with reassignment
Owners must be able to permanently offboard a staff member with proper data handoff.

**Acceptance criteria:**
- Two-step confirmation:
  - Step 1: Show impact summary (count of open appointments, intakes, designs to reassign)
  - Step 2: Type staff member's name to confirm
- Open appointments reassigned (staffId set to null, flagged as needs_reassignment)
- Open Second Sight intakes reassigned (same pattern)
- Open custom designs transferred
- Clerk user banned
- publicMetadata updated: `{ offboarded: true, offboarded_at: ISO, offboarded_by: actorId }` — merged with existing metadata, not overwritten
- Audit log with full reassignment summary

**Source:** Audit findings — only one step existed, metadata was overwritten (wiping role/locations)

---

## Staff Management UI

### REQ-B-009: Staff list page
A page at `/crm/settings/staff` must show all staff with their status, role, and locations.

**Acceptance criteria:**
- Shows active staff, suspended staff, and pending invitations
- Each row shows: name, email, role (colored badge), locations (badges), status
- Filterable by role and location
- Requires `org:settings:staff` permission

---

### REQ-B-010: Staff actions
Each staff row must provide contextual actions based on the viewer's permissions.

**Acceptance criteria:**
- Edit role (opens confirmation modal) — REQ-B-004
- Edit locations (opens location picker) — REQ-B-005
- Suspend / Reinstate toggle — REQ-B-006, REQ-B-007
- Offboard (opens two-step modal) — REQ-B-008
- Revoke invitation (for pending rows) — REQ-B-003
- Actions hidden when viewer lacks permission

---

## Out of Scope for Phase B

- Permissions inspector modal (V2)
- Offboarding activity PDF report (V2)
- MFA enforcement (Clerk dashboard config)
- Future roles (stylist, production, marketing, partner)

---

## Traceability

| Requirement | Audit Finding | Spec 07 Section |
|---|---|---|
| REQ-B-001 | — | §1.11 (Invite) |
| REQ-B-002 | — | §1.12 |
| REQ-B-003 | Revoke 404 | §1.11 |
| REQ-B-004 | No confirmation modal | §1.11 (Update role) |
| REQ-B-005 | Location editing missing | §1.11 (Update locations) |
| REQ-B-006 | — | §1.11 (Suspend) |
| REQ-B-007 | — | §1.11 (Reinstate) |
| REQ-B-008 | One-step, metadata wipe | §1.11 (Offboard) |
| REQ-B-009 | Missing page auth | §1.12 |
| REQ-B-010 | — | §1.12 |
