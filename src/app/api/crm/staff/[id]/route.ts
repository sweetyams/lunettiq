import { requireCrmAuth } from '@/lib/crm/auth';
import { writeAudit } from '@/lib/crm/audit';
import { isValidRole } from '@/lib/crm/permissions';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

const clerkFetch = (path: string, opts?: RequestInit) =>
  fetch(`https://api.clerk.com/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, 'Content-Type': 'application/json', ...opts?.headers },
  });

export const PATCH = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:settings:staff');
  const userId = ctx.params.id;
  const body = await request.json();

  // Fetch current user
  const userRes = await clerkFetch(`/users/${userId}`);
  if (!userRes.ok) return jsonError('User not found', 404);
  const user = await userRes.json();
  const oldMeta = (user.public_metadata ?? {}) as Record<string, unknown>;

  // Role validation
  if (body.role !== undefined) {
    if (!isValidRole(body.role)) return jsonError('Invalid role', 400);
    if ((body.role === 'owner' || body.role === 'manager') && session.role !== 'owner') return jsonError('Only owners can promote to owner or manager', 403);
    // Prevent demoting last owner
    if (oldMeta.role === 'owner' && body.role !== 'owner') {
      const allUsersRes = await clerkFetch('/users?limit=200');
      const allUsers = allUsersRes.ok ? (await allUsersRes.json()).data ?? [] : [];
      const ownerCount = allUsers.filter((u: any) => u.public_metadata?.role === 'owner').length;
      if (ownerCount <= 1) return jsonError('Cannot demote the last owner', 400);
    }
  }

  // Location validation
  if (body.locationIds !== undefined) {
    if (!Array.isArray(body.locationIds) || body.locationIds.length === 0) return jsonError('locationIds must be non-empty', 400);
    const primary = body.primaryLocationId ?? oldMeta.primary_location_id;
    if (primary && !body.locationIds.includes(primary)) return jsonError('primaryLocationId must be in locationIds', 400);
  }

  if (body.bypassLocationScope === true && session.role !== 'owner') return jsonError('Only owners can set bypassLocationScope', 403);

  // Merge metadata
  const newMeta = { ...oldMeta };
  if (body.role !== undefined) newMeta.role = body.role;
  if (body.locationIds !== undefined) newMeta.location_ids = body.locationIds;
  if (body.primaryLocationId !== undefined) newMeta.primary_location_id = body.primaryLocationId;
  if (body.canViewAllLocations !== undefined) newMeta.can_view_all_locations = body.canViewAllLocations;
  if (body.bypassLocationScope !== undefined) newMeta.bypass_location_scope = body.bypassLocationScope;

  const res = await clerkFetch(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ public_metadata: newMeta }),
  });
  if (!res.ok) return jsonError('Failed to update user', res.status);

  await writeAudit({
    session, action: 'update', entityType: 'staff', entityId: userId,
    diff: { before: { role: oldMeta.role, location_ids: oldMeta.location_ids }, after: body },
  });

  return jsonOk({ id: userId, ...newMeta });
});
