export const dynamic = "force-dynamic";
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const GET = handler(async () => {
  await requireCrmAuth('org:appointments:read');

  const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
  if (!CLERK_SECRET) return jsonError('Clerk not configured', 500);

  const res = await fetch('https://api.clerk.com/v1/users?limit=50&order_by=-created_at', {
    headers: { Authorization: `Bearer ${CLERK_SECRET}` },
  });
  if (!res.ok) return jsonError('Failed to fetch staff', 502);

  const data = await res.json();
  const staff = (data.data || data || []).map((u: Record<string, unknown>) => ({
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    imageUrl: u.image_url,
  }));

  return jsonOk(staff);
});
