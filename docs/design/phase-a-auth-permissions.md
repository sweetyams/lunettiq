# Phase A — Auth & Permissions: Design

**Status:** DRAFT
**Prereq:** phase-a-auth-permissions.md (requirements)

---

## D-001: Session shape & extraction (REQ-A-001, REQ-A-002, REQ-A-009)

**File:** `src/lib/crm/auth.ts`

Keep the existing dual-auth flow (cookie + Bearer). Change `extractSession`:

```ts
export const CRM_ROLES = ['owner', 'manager', 'optician', 'sa', 'read_only'] as const;
export type CrmRole = (typeof CRM_ROLES)[number];

function extractSession(userId: string, meta: Record<string, unknown>): CrmSession | null {
  const role = meta.role as string | undefined;
  if (!role || !CRM_ROLES.includes(role as CrmRole)) return null;  // REQ-A-001: no fallback

  return {
    userId,
    role: role as CrmRole,
    locationIds: (meta.location_ids as string[]) ?? [],
    primaryLocationId: (meta.primary_location_id as string) ?? null,
    canViewAllLocations: meta.can_view_all_locations === true,
    bypassLocationScope: meta.bypass_location_scope === true,
  };
}
```

`getCrmSession()` returns `null` when role is missing/invalid. `requireCrmAuth()` throws 401 on `null`.

No changes to the Bearer token verification flow — it already works.

---

## D-002: Permission matrix (REQ-A-004)

**File:** `src/lib/crm/permissions.ts`

Replace the current file. Single source of truth for roles and permissions.

Structure:
- `PERMISSIONS` — flat array of all ~60 permission keys (from Clerk permissions doc §2)
- `ROLE_PERMISSIONS` — `Record<CrmRole, Set<string>>` with owner using wildcard `*`
- `hasPermission(role, permission)` — O(1) Set lookup, owner always true
- `getPermissions(role)` — returns full list for a role (owner expands wildcard)

Role keys: `owner`, `manager`, `optician`, `sa`, `read_only`. No aliases.

Permission values copied exactly from the Clerk permissions doc §3.1–3.5 (already in the current file — verify against doc and add any missing ones like `org:tryon:*` and `org:recs:*` from spec 07).

---

## D-003: Server-side helpers (REQ-A-005)

**File:** `src/lib/crm/auth.ts` (extend)

```ts
async function requirePermission(permission: string): Promise<CrmSession>
async function requireAnyPermission(permissions: string[]): Promise<CrmSession>
async function checkPermission(permission: string): Promise<boolean>
```

All three call `getCrmSession()` internally. `requirePermission` and `requireAnyPermission` throw 401 (no session) or 403 (no permission). They return the session on success so callers can use it.

`requireCrmAuth(permission?)` stays as a convenience wrapper — calls `requirePermission` when permission is provided.

---

## D-004: Client-side hooks (REQ-A-006)

**File:** `src/lib/crm/use-permissions.ts`

```ts
'use client';
import { useUser } from '@clerk/nextjs';
import { hasPermission, CrmRole, CRM_ROLES } from './permissions';

export function usePermission(permission: string): boolean {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string;
  if (!role || !CRM_ROLES.includes(role as CrmRole)) return false;
  return hasPermission(role as CrmRole, permission);
}

export function useAnyPermission(permissions: string[]): boolean {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string;
  if (!role || !CRM_ROLES.includes(role as CrmRole)) return false;
  return permissions.some(p => hasPermission(role as CrmRole, p));
}
```

---

## D-005: Location scope helper (REQ-A-007, REQ-A-008)

**File:** `src/lib/crm/location-scope.ts` (new)

```ts
export function getLocationScope(session: CrmSession): {
  bypass: boolean;
  locationIds: string[];
  primaryLocationId: string | null;
}

export function applyLocationFilter(
  locationColumn: AnyColumn,
  scope: ReturnType<typeof getLocationScope>
): SQL | undefined
```

`getLocationScope` reads from the session (already resolved). Bypass is true if `canViewAllLocations` or `bypassLocationScope`.

`applyLocationFilter` returns `inArray(column, locationIds)` or `undefined` for bypass. Callers add it to their `where` clause with `and()`.

No async — session is already resolved by the auth layer.

---

## D-006: Surface identification (REQ-A-010)

**File:** `src/middleware.ts` (modify existing)

Add to the existing `clerkMiddleware` callback:

```ts
if (pathname.startsWith('/crm') || pathname.startsWith('/api/crm')) {
  const surface = request.headers.get('x-crm-surface') ?? 'web';
  const response = NextResponse.next();
  response.headers.set('x-crm-surface', surface);
  return response;
}
```

Web app defaults to `web`. Tablet/phone apps send their own value. The auth layer reads it from the request header and passes it through to audit log writers.

---

## D-007: Server page auth (REQ-A-003)

**File:** Every `src/app/crm/**/page.tsx` (18 files)

Add `await requirePermission('org:<feature>:read')` as the first line of each server component, before any DB query.

Page-to-permission mapping:

| Page | Permission |
|---|---|
| `/crm` (dashboard) | `org:clients:read` |
| `/crm/clients` | `org:clients:read` |
| `/crm/clients/[id]` | `org:clients:read` |
| `/crm/clients/new` | `org:clients:create` |
| `/crm/clients/duplicates` | `org:clients:merge` |
| `/crm/products` | `org:products:read` |
| `/crm/products/[id]` | `org:products:read` |
| `/crm/appointments` | `org:appointments:read` |
| `/crm/appointments/new` | `org:appointments:create` |
| `/crm/segments` | `org:segments:read` |
| `/crm/second-sight` | `org:second_sight:read` |
| `/crm/second-sight/new` | `org:second_sight:create` |
| `/crm/orders/[id]` | `org:orders:read` |
| `/crm/settings` | `org:settings:staff` |
| `/crm/settings/staff` | `org:settings:staff` |
| `/crm/settings/tags` | `org:settings:tags` |
| `/crm/settings/locations` | `org:settings:locations` |
| `/crm/settings/audit` | `org:audit:read_own_location` |

On 401: redirect to Clerk sign-in.
On 403: render an inline "You don't have access to this page" message (not a redirect).

---

## D-008: Audit log schema & writer (REQ-A-011)

**Existing table:** `audit_log` — already has the right shape. Add one column:

- `actor_role text` — the role at time of action (roles can change, so snapshot it)

Add one index:
- `idx_audit_staff` on `(staff_id, created_at)` — for the audit viewer's actor filter

**Audit writer helper:**

**File:** `src/lib/crm/audit.ts` (new)

```ts
export async function writeAudit(params: {
  session: CrmSession;
  action: AuditAction;
  entityType: string;
  entityId: string;
  diff?: Record<string, unknown>;
  surface?: string;
}): Promise<void>
```

Reads surface from request header. Inserts to `audit_log`. Fire-and-forget (don't block the response on audit writes — use `Promise` without `await` at call sites, or batch).

For auth failures (REQ-A-011 bullet 2): a separate `writeAuthFailure` function that logs with `status: 'denied'` and whatever actor info is available.

---

## D-009: Audit viewer page (REQ-A-012)

**File:** `src/app/crm/settings/audit/page.tsx` (already exists — rebuild)

Server component:
1. `requirePermission('org:audit:read_own_location')`
2. If user has `org:audit:read_all` → no location filter
3. Else → filter by user's `locationIds`
4. Query `audit_log` with filters from search params: `dateFrom`, `dateTo`, `actor`, `action`, `entityType`
5. Paginate at 50 per page

Render a table: Date, Actor, Action, Entity, Location, Details (expandable diff).

No client component needed — server-rendered with URL-based filters.

---

## Files changed summary

| File | Action | REQs |
|---|---|---|
| `src/lib/crm/auth.ts` | Modify | 001, 002, 005, 009 |
| `src/lib/crm/permissions.ts` | Rewrite | 002, 004 |
| `src/lib/crm/use-permissions.ts` | New | 006 |
| `src/lib/crm/location-scope.ts` | New | 007, 008 |
| `src/lib/crm/audit.ts` | New | 011 |
| `src/middleware.ts` | Modify | 010 |
| `src/lib/db/schema.ts` | Modify (add column + index) | 011 |
| `src/app/crm/**/page.tsx` (×18) | Modify (add auth) | 003 |
| `src/app/crm/settings/audit/page.tsx` | Rebuild | 012 |

---

## What this does NOT change

- DB schema (beyond one audit_log column)
- Inngest functions
- Webhook pipeline
- Shopify integration
- Any API route handler logic (auth calls already exist — they just use the improved helpers)
- CRM layout/shell component
