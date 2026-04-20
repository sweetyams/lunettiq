# Clerk — Staff Authentication

**Purpose:** Authenticates CRM staff, manages roles and permissions.

## How It Works

Clerk handles all staff login/session management. Roles are stored in `user.publicMetadata`:

```json
{ "role": "owner", "locationIds": ["loc_plateau", "loc_dix30"] }
```

Roles: `owner`, `manager`, `optician`, `sa`, `read_only`

The app enforces permissions in code via `src/lib/crm/permissions.ts` (Clerk free tier doesn't support custom permissions natively).

## Files

| File | Purpose |
|---|---|
| `src/lib/crm/auth.ts` | `requireCrmAuth()`, `getCrmSession()`, permission checks |
| `src/lib/crm/permissions.ts` | Role→permission matrix, `hasPermission()` |
| `src/lib/crm/use-permissions.ts` | Client-side hooks: `usePermission()`, `useCrmRole()` |
| `src/middleware.ts` | Clerk middleware for `/crm/*` route protection |

## Environment Variables

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx   # Client-side
CLERK_SECRET_KEY=sk_test_xxx                     # Server-side
```

### Where to Find

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Select your application
3. API Keys → copy both keys

## Production Setup

1. Create a Clerk production instance (separate from development)
2. Set production keys in Vercel env vars
3. Configure allowed domains in Clerk dashboard
4. Set up staff users with `publicMetadata` roles via Clerk dashboard or API

## Staff Management

Staff are managed at `/crm/settings/staff`:
- Invite new staff (creates Clerk user)
- Assign roles and locations
- Set working schedules
- Suspend/offboard

All role changes go through the Clerk API and are reflected immediately.
