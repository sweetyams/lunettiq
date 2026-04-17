export const dynamic = "force-dynamic";
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonList, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const GET = handler(async () => {
  await requireCrmAuth('org:settings:staff');

  const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
  if (!CLERK_SECRET) return jsonError('Clerk not configured', 500);

  const res = await fetch('https://api.clerk.com/v1/users?limit=50&order_by=-created_at', {
    headers: { Authorization: `Bearer ${CLERK_SECRET}` },
  });

  if (!res.ok) return jsonError('Failed to fetch staff', 502);

  const data = await res.json();
  const staff = (data.data || data || []).map((u: Record<string, unknown>) => {
    const meta = (u.public_metadata ?? {}) as Record<string, unknown>;
    const emails = (u.email_addresses ?? []) as Array<{ email_address: string }>;
    return {
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: emails[0]?.email_address,
      role: meta.role || 'read_only',
      locationIds: meta.location_ids || meta.locationIds || [],
      imageUrl: u.image_url,
    };
  });

  return jsonList(staff, { total: staff.length, limit: staff.length, offset: 0 });
});
