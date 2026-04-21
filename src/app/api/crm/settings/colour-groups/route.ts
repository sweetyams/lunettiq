export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { colourGroups } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth();
  const rows = await db.select().from(colourGroups).orderBy(colourGroups.sortOrder);
  return jsonOk(rows);
});

export const POST = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const { id, label, members } = await request.json();
  if (!id || !label || !members?.length) return jsonError('id, label, members required', 400);
  await db.insert(colourGroups).values({ id, label, members }).onConflictDoUpdate({
    target: colourGroups.id,
    set: { label, members },
  });
  return jsonOk({ id });
});

export const DELETE = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const { id } = await request.json();
  if (!id) return jsonError('id required', 400);
  await db.delete(colourGroups).where(eq(colourGroups.id, id));
  return jsonOk({ deleted: id });
});
