export const dynamic = "force-dynamic";
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

const clerkHeaders = () => ({ Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` });

export const GET = handler(async () => {
  await requireCrmAuth('org:settings:staff');

  const res = await fetch('https://api.clerk.com/v1/invitations?status=pending&limit=50', {
    headers: clerkHeaders(),
  });
  if (!res.ok) return jsonError('Failed to fetch invitations', 502);

  const data = await res.json();
  const invitations = (data.data || data || []).map((inv: Record<string, unknown>) => {
    const meta = (inv.public_metadata ?? {}) as Record<string, unknown>;
    return {
      id: inv.id,
      emailAddress: inv.email_address,
      role: meta.role || 'sa',
      locationIds: meta.location_ids || [],
      createdAt: inv.created_at,
    };
  });

  return jsonOk(invitations);
});
