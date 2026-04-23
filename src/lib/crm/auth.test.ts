import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CrmSession } from './auth';

// ─── Mocks ───────────────────────────────────────────────

const mockAuth = vi.fn();
const mockHeaders = vi.fn();
const mockRedirect = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: any[]) => mockAuth(...args),
  clerkClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: (...args: any[]) => mockHeaders(...args),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: any[]) => mockRedirect(...args),
}));

// Import after mocks are set up
const { requireCrmAuth, requirePermission, requireAnyPermission, checkPermission, canAccessLocation, getCrmSession } = await import('./auth');

// ─── Helpers ─────────────────────────────────────────────

function mockSession(meta: Record<string, unknown>) {
  mockHeaders.mockResolvedValue({ get: () => null });
  mockAuth.mockResolvedValue({
    userId: 'user_test',
    sessionClaims: { publicMetadata: meta },
  });
}

function mockNoSession() {
  mockHeaders.mockResolvedValue({ get: () => null });
  mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });
}

const ownerMeta = { role: 'owner', location_ids: ['loc_a'], primary_location_id: 'loc_a', can_view_all_locations: true, bypass_location_scope: false };
const readOnlyMeta = { role: 'read_only', location_ids: ['loc_b'], primary_location_id: 'loc_b' };
const saMeta = { role: 'sa', location_ids: ['loc_a', 'loc_b'] };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getCrmSession ───────────────────────────────────────

describe('getCrmSession', () => {
  it('returns null when not authenticated', async () => {
    mockNoSession();
    expect(await getCrmSession()).toBeNull();
  });

  it('returns session for valid role', async () => {
    mockSession(ownerMeta);
    const s = await getCrmSession();
    expect(s).toMatchObject({ userId: 'user_test', role: 'owner', locationIds: ['loc_a'], canViewAllLocations: true });
  });

  it('returns null for invalid role', async () => {
    mockSession({ role: 'hacker' });
    expect(await getCrmSession()).toBeNull();
  });

  it('returns null when role is missing', async () => {
    mockSession({});
    expect(await getCrmSession()).toBeNull();
  });

  it('defaults locationIds to empty array', async () => {
    mockSession({ role: 'owner' });
    const s = await getCrmSession();
    expect(s!.locationIds).toEqual([]);
  });

  it('checks Bearer header first', async () => {
    mockHeaders.mockResolvedValue({ get: (h: string) => h === 'authorization' ? 'Bearer tok_123' : null });
    // Bearer resolution will fail (no real Clerk), so session is null
    const s = await getCrmSession();
    expect(s).toBeNull();
    // auth() should NOT have been called since Bearer path was taken
    expect(mockAuth).not.toHaveBeenCalled();
  });
});

// ─── requireCrmAuth ──────────────────────────────────────

describe('requireCrmAuth', () => {
  it('returns session when authenticated (no permission)', async () => {
    mockSession(readOnlyMeta);
    const s = await requireCrmAuth();
    expect(s.role).toBe('read_only');
  });

  it('throws 401 when not authenticated', async () => {
    mockNoSession();
    await expect(requireCrmAuth()).rejects.toThrow('Unauthorized');
    try { await requireCrmAuth(); } catch (e: any) { expect(e.status).toBe(401); }
  });

  it('returns session when permission is granted', async () => {
    mockSession(ownerMeta);
    const s = await requireCrmAuth('org:settings:staff');
    expect(s.role).toBe('owner');
  });

  it('throws 403 when permission is denied', async () => {
    mockSession(readOnlyMeta);
    await expect(requireCrmAuth('org:settings:staff')).rejects.toThrow('Forbidden');
    try { await requireCrmAuth('org:settings:staff'); } catch (e: any) { expect(e.status).toBe(403); }
  });

  it('throws 401 for invalid role (no fallback)', async () => {
    mockSession({ role: 'intern' });
    await expect(requireCrmAuth()).rejects.toThrow('Unauthorized');
  });
});

// ─── requirePermission ───────────────────────────────────

describe('requirePermission', () => {
  it('returns session when permission is granted', async () => {
    mockSession(readOnlyMeta);
    const s = await requirePermission('org:clients:read');
    expect(s.role).toBe('read_only');
  });

  it('throws 401 when not authenticated', async () => {
    mockNoSession();
    await expect(requirePermission('org:clients:read')).rejects.toThrow('Unauthorized');
  });

  it('redirects to /crm/denied when permission is denied', async () => {
    mockSession(readOnlyMeta);
    await requirePermission('org:settings:staff');
    expect(mockRedirect).toHaveBeenCalledWith('/crm/denied');
  });

  it('owner is never redirected', async () => {
    mockSession(ownerMeta);
    await requirePermission('org:settings:staff');
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

// ─── requireAnyPermission ────────────────────────────────

describe('requireAnyPermission', () => {
  it('returns session when at least one permission matches', async () => {
    mockSession(readOnlyMeta);
    const s = await requireAnyPermission(['org:settings:staff', 'org:clients:read']);
    expect(s.role).toBe('read_only');
  });

  it('throws 403 when no permissions match', async () => {
    mockSession(readOnlyMeta);
    await expect(requireAnyPermission(['org:settings:staff', 'org:credits:adjust'])).rejects.toThrow('Forbidden');
  });

  it('throws 401 when not authenticated', async () => {
    mockNoSession();
    await expect(requireAnyPermission(['org:clients:read'])).rejects.toThrow('Unauthorized');
  });
});

// ─── checkPermission ─────────────────────────────────────

describe('checkPermission', () => {
  it('returns true when permission is granted', async () => {
    mockSession(readOnlyMeta);
    expect(await checkPermission('org:clients:read')).toBe(true);
  });

  it('returns false when permission is denied', async () => {
    mockSession(readOnlyMeta);
    expect(await checkPermission('org:settings:staff')).toBe(false);
  });

  it('returns false when not authenticated', async () => {
    mockNoSession();
    expect(await checkPermission('org:clients:read')).toBe(false);
  });
});

// ─── canAccessLocation ───────────────────────────────────

describe('canAccessLocation', () => {
  const base: CrmSession = {
    userId: 'u1', role: 'sa', locationIds: ['loc_a', 'loc_b'],
    primaryLocationId: 'loc_a', canViewAllLocations: false, bypassLocationScope: false,
  };

  it('grants access to assigned location', () => {
    expect(canAccessLocation(base, 'loc_a')).toBe(true);
    expect(canAccessLocation(base, 'loc_b')).toBe(true);
  });

  it('denies access to unassigned location', () => {
    expect(canAccessLocation(base, 'loc_c')).toBe(false);
  });

  it('grants access to any location when canViewAllLocations', () => {
    expect(canAccessLocation({ ...base, canViewAllLocations: true }, 'loc_z')).toBe(true);
  });

  it('grants access to any location when bypassLocationScope', () => {
    expect(canAccessLocation({ ...base, bypassLocationScope: true }, 'loc_z')).toBe(true);
  });

  it('denies with empty locationIds', () => {
    expect(canAccessLocation({ ...base, locationIds: [] }, 'loc_a')).toBe(false);
  });
});
