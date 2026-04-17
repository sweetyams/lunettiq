import { requireCrmAuth } from '@/lib/crm/auth';
import { writeAudit } from '@/lib/crm/audit';
import { isValidRole } from '@/lib/crm/permissions';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:settings:staff');
  const { email, role, locationIds, primaryLocationId } = await request.json();

  if (!email || !role) return jsonError('email and role required', 400);
  if (!isValidRole(role)) return jsonError(`Invalid role: ${role}`, 400);
  if (!Array.isArray(locationIds) || locationIds.length === 0) return jsonError(`locationIds required, got: ${JSON.stringify(locationIds)}`, 400);
  if (!primaryLocationId || !locationIds.includes(primaryLocationId)) return jsonError(`primaryLocationId "${primaryLocationId}" must be in locationIds ${JSON.stringify(locationIds)}`, 400);
  if ((role === 'owner' || role === 'manager') && session.role !== 'owner') return jsonError('Only owners can invite owners or managers', 403);

  const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
  if (!CLERK_SECRET) return jsonError('Clerk not configured', 500);

  const res = await fetch('https://api.clerk.com/v1/invitations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLERK_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_address: email,
      public_metadata: { role, location_ids: locationIds, primary_location_id: primaryLocationId },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return jsonError(err.errors?.[0]?.message || 'Failed to send invitation', res.status);
  }

  const invitation = await res.json();

  await writeAudit({
    session, action: 'create', entityType: 'staff_invitation', entityId: invitation.id,
    diff: { email, role, locationIds, primaryLocationId },
  });

  return jsonOk(invitation, 201);
});
