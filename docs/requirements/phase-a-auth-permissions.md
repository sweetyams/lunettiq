# Phase A — Auth & Permissions: Requirements

**Status:** DRAFT — awaiting review
**Scope:** Authentication, authorization, role system, location scoping, audit foundation
**Sources:** Spec 07 §1, Clerk permissions doc, audit findings (2026-04-16)

---

## Critical Fixes (from audit)

### REQ-A-001: No default role escalation
When a Clerk user has no role in their metadata, the system must deny access entirely (401). It must never fall back to a privileged role.

**Acceptance criteria:**
- A user with missing/empty `role` metadata is rejected with 401 on any CRM API call
- A user with missing/empty `role` metadata sees an "Access denied" page on any CRM route
- No default role is assumed anywhere in the codebase

**Source:** Audit finding — `auth.ts:44` defaults to `owner`

---

### REQ-A-002: Role naming consistency
The system must use a single, canonical set of role keys everywhere: code, Clerk metadata, UI display.

**Acceptance criteria:**
- Canonical role keys: `owner`, `manager`, `optician`, `sa`, `read_only`
- Future roles (not enforced in V1): `stylist`, `production`, `marketing`, `partner`
- Every file that references roles uses the canonical keys
- A single source-of-truth type definition exists for valid roles
- Clerk `publicMetadata.role` values match the canonical keys exactly

**Source:** Audit finding — `sa` vs `sales_associate`, `read_only` vs `readonly` inconsistency

---

### REQ-A-003: Server pages must check auth
Every CRM server page (`/crm/**`) must verify the user is authenticated and has the minimum permission for that page before executing any database query.

**Acceptance criteria:**
- All 18 CRM server pages call an auth check before any data fetching
- Unauthenticated users are redirected to sign-in
- Users without the required permission see a 403 page
- No database query executes before auth is verified

**Source:** Audit finding — 0 of 18 server pages call `requireCrmAuth`

---

## Permission System

### REQ-A-004: App-enforced permission matrix
The system must enforce ~60 permissions across 5 active roles using an in-app permission matrix (Clerk free tier does not support custom permissions).

**Acceptance criteria:**
- Permission keys follow the convention `org:<feature>:<action>`
- The full permission list from the Clerk permissions doc (§2.1–2.16) is defined in code
- Role-to-permission mappings match the matrices in the Clerk permissions doc (§3.1–3.5)
- Owner role has all permissions (wildcard)
- A role with no matching permission entry gets zero permissions (not all)
- Permission checks are O(1) lookups

**Source:** Spec 07 §1.4–1.5, Clerk permissions doc §2–3

---

### REQ-A-005: Server-side permission helpers
The system must provide server-side helpers for checking permissions in API routes and server components.

**Acceptance criteria:**
- `requirePermission(permission)` — throws 403 if the current user lacks the permission
- `requireAnyPermission(permissions[])` — throws 403 if the user has none of the listed permissions
- `hasPermission(permission)` — returns boolean, does not throw
- All helpers resolve the current user from the Clerk session (cookie or Bearer token)
- All helpers work in both API routes and server components

**Source:** Spec 07 §1.10

---

### REQ-A-006: Client-side permission helpers
The system must provide React hooks for conditionally rendering UI based on permissions.

**Acceptance criteria:**
- `usePermission(permission)` — returns boolean
- `useAnyPermission(permissions[])` — returns boolean
- Hooks derive permissions from the user's role (available via Clerk session)
- UI elements gated by permissions are not rendered (not just hidden via CSS)

**Source:** Spec 07 §1.10

---

## Location Scoping

### REQ-A-007: Location scoping via membership metadata
Users must be scoped to specific locations. Location determines which data rows they can see, independent of their permissions.

**Acceptance criteria:**
- Each user's Clerk `publicMetadata` contains: `location_ids` (string[]), `primary_location_id` (string), `can_view_all_locations` (boolean)
- Owners have `can_view_all_locations: true`
- Opticians bypass location scope (separate `bypass_location_scope` flag)
- Managers and SAs are restricted to their `location_ids`
- A user with no `location_ids` and no bypass flag sees zero location-scoped records

**Source:** Spec 07 §1.8, Clerk permissions doc §4

---

### REQ-A-008: Location filter helper
A reusable helper must apply location filtering to any database query on a location-scoped table.

**Acceptance criteria:**
- Helper reads location metadata from the current session
- Returns a SQL condition (`WHERE location_id IN (...)`) or `undefined` for bypass users
- Every location-scoped query (appointments, interactions, intakes, etc.) uses this helper
- Bypass users see all locations without an extra query

**Source:** Spec 07 §1.8

---

## Session & Auth Flow

### REQ-A-009: Dual auth support (cookie + Bearer)
The system must support both Clerk cookie auth (web) and Bearer token auth (native/tablet apps).

**Acceptance criteria:**
- Web requests authenticate via Clerk session cookie
- API requests with `Authorization: Bearer <token>` authenticate via Clerk token verification
- Both paths resolve to the same session shape (userId, role, locationIds, etc.)
- Invalid/expired tokens return 401

**Source:** Existing implementation (keep), Spec 07 §1.7

---

### REQ-A-010: Surface identification
Every CRM request must identify its source surface for audit logging.

**Acceptance criteria:**
- Clients send `X-CRM-Surface` header with value `web`, `tablet`, or `phone`
- If header is missing, surface defaults to `unknown`
- Surface value is available to audit log writers on every request
- Surface is not used for authorization decisions (audit only)

**Source:** Spec 07 §1.9

---

## Audit Foundation

### REQ-A-011: Audit log on all auth-sensitive actions
Every action that creates, updates, or deletes data must write to the audit log.

**Acceptance criteria:**
- Audit log entry includes: `actor_id`, `action`, `entity_type`, `entity_id`, `surface`, `location_id`, `diff` (before/after), `created_at`
- Auth failures (401, 403) are logged with the attempted action and actor (if identifiable)
- Audit log is append-only (no updates or deletes)
- Audit log is queryable by entity, actor, action, location, and date range

**Source:** Spec 07 §1.14

---

### REQ-A-012: Audit viewer page
Owners and managers must be able to view the audit log in the CRM.

**Acceptance criteria:**
- Available at `/crm/settings/audit`
- Owners (`org:audit:read_all`) see all entries
- Managers (`org:audit:read_own_location`) see entries scoped to their locations
- Filterable by: date range, actor, action type, entity type
- Paginated (50 entries per page)

**Source:** Spec 07 §1.14

---

## Out of Scope for Phase A

These are explicitly deferred:

- Staff lifecycle APIs (invite, suspend, offboard) → Phase B
- Staff management UI → Phase B
- MFA enforcement → Clerk dashboard config, not app code
- Session duration config → Clerk dashboard config
- Future roles (stylist, production, marketing, partner) → V2
- Permissions inspector modal → Phase B

---

## Traceability

| Requirement | Audit Finding | Spec 07 Section | Clerk Doc Section |
|---|---|---|---|
| REQ-A-001 | Default role = owner | §1.8 | — |
| REQ-A-002 | Role naming mismatch | §1.3 | §1 |
| REQ-A-003 | 0/18 pages check auth | — | — |
| REQ-A-004 | — | §1.4–1.5 | §2–3 |
| REQ-A-005 | — | §1.10 | §5 |
| REQ-A-006 | — | §1.10 | §5 |
| REQ-A-007 | — | §1.8 | §4 |
| REQ-A-008 | — | §1.8 | §4.2 |
| REQ-A-009 | — | §1.7 | — |
| REQ-A-010 | — | §1.9 | §7.4 |
| REQ-A-011 | — | §1.14 | — |
| REQ-A-012 | — | §1.14 | — |
