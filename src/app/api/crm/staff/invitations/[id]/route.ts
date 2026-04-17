export const dynamic = "force-dynamic";
import { requireCrmAuth } from '@/lib/crm/auth';
import { writeAudit } from '@/lib/crm/audit';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const DELETE = handler(async (_request, ctx) => {
  const session = await requireCrmAuth('org:settings:staff');
  const invitationId = ctx.params.id;

  const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
  if (!CLERK_SECRET) return jsonError('Clerk not configured', 500);

  const res = await fetch(`https://api.clerk.com/v1/invitations/${invitationId}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLERK_SECRET}` },
  });

  if (!res.ok) return jsonError('Failed to revoke invitation', res.status);

  await writeAudit({
    session, action: 'delete', entityType: 'staff_invitation', entityId: invitationId,
  });

  return jsonOk({ id: invitationId, revoked: true });
});
