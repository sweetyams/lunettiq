export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, asc } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth();
  const rows = await db.select().from(locations).orderBy(asc(locations.name));
  return jsonOk(rows);
});

export const PATCH = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const { id, ...data } = await req.json();
  if (!id) return jsonError('id required', 400);
  const [row] = await db.update(locations).set(data).where(eq(locations.id, id)).returning();
  if (!row) return jsonError('Not found', 404);
  return jsonOk(row);
});
