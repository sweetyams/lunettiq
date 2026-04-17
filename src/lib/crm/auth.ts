import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { hasPermission, isValidRole, type CrmRole } from './permissions';

export type { CrmRole } from './permissions';

export interface CrmSession {
  userId: string;
  role: CrmRole;
  locationIds: string[];
  primaryLocationId: string | null;
  canViewAllLocations: boolean;
  bypassLocationScope: boolean;
}

// ─── Session extraction ──────────────────────────────────

function extractSession(userId: string, meta: Record<string, unknown>): CrmSession | null {
  const role = meta.role;
  if (!isValidRole(role)) return null; // REQ-A-001: no fallback

  return {
    userId,
    role,
    locationIds: (meta.location_ids as string[]) ?? [],
    primaryLocationId: (meta.primary_location_id as string) ?? null,
    canViewAllLocations: meta.can_view_all_locations === true,
    bypassLocationScope: meta.bypass_location_scope === true,
  };
}

// ─── Dual auth: cookie + Bearer ──────────────────────────

const CLERK_SECRET = () => process.env.CLERK_SECRET_KEY!;

async function resolveBearer(token: string): Promise<CrmSession | null> {
  try {
    const res = await fetch('https://api.clerk.com/v1/sessions/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLERK_SECRET()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const session = await res.json();
    const userId = session.user_id as string;
    if (!userId) return null;

    const userRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET()}` },
    });
    if (!userRes.ok) return null;
    const user = await userRes.json();
    return extractSession(userId, user.public_metadata ?? {});
  } catch {
    return null;
  }
}

export async function getCrmSession(): Promise<CrmSession | null> {
  // Bearer token (native apps)
  const h = await headers();
  const authHeader = h.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return resolveBearer(authHeader.slice(7));

  // Clerk cookie (web)
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  return extractSession(userId, (sessionClaims?.publicMetadata ?? {}) as Record<string, unknown>);
}

// ─── Auth helpers ────────────────────────────────────────

function throwAuth(message: string, status: number): never {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  throw err;
}

/** Require auth + optional permission check. Returns session. */
export async function requireCrmAuth(permission?: string): Promise<CrmSession> {
  const session = await getCrmSession();
  if (!session) throwAuth('Unauthorized', 401);
  if (permission && !hasPermission(session.role, permission)) throwAuth('Forbidden', 403);
  return session;
}

/** Require auth + specific permission. Returns session. */
export async function requirePermission(permission: string): Promise<CrmSession> {
  return requireCrmAuth(permission);
}

/** Require auth + any of the listed permissions. Returns session. */
export async function requireAnyPermission(permissions: string[]): Promise<CrmSession> {
  const session = await getCrmSession();
  if (!session) throwAuth('Unauthorized', 401);
  if (!permissions.some(p => hasPermission(session.role, p))) throwAuth('Forbidden', 403);
  return session;
}

/** Check a permission without throwing. Returns boolean. */
export async function checkPermission(permission: string): Promise<boolean> {
  const session = await getCrmSession();
  if (!session) return false;
  return hasPermission(session.role, permission);
}

/** Check if session can access a specific location */
export function canAccessLocation(session: CrmSession, locationId: string): boolean {
  if (session.canViewAllLocations || session.bypassLocationScope) return true;
  return session.locationIds.includes(locationId);
}
