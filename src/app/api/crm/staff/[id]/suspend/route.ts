import { requireCrmAuth } from '@/lib/crm/auth';
import { writeAudit } from '@/lib/crm/audit';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:settings:staff');
  const userId = ctx.params.id;
  const { action, reason } = await request.json();

  if (action !== 'suspend' && action !== 'reinstate') return jsonError('action must be suspend or reinstate', 400);

  const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
  if (!CLERK_SECRET) return jsonError('Clerk not configured', 500);

  const endpoint = action === 'suspend'
    ? `https://api.clerk.com/v1/users/${userId}/ban`
    : `https://api.clerk.com/v1/users/${userId}/unban`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLERK_SECRET}` },
  });
  if (!res.ok) return jsonError(`Failed to ${action}`, res.status);

  await writeAudit({
    session, action: 'update', entityType: 'staff', entityId: userId,
    diff: { action, reason: reason ?? null },
  });

  return jsonOk({ id: userId, action });
});
