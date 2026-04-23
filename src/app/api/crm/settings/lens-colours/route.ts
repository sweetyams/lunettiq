export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { lensColourSets, lensColourOptions } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, asc } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth();
  const [sets, colours] = await Promise.all([
    db.select().from(lensColourSets).orderBy(asc(lensColourSets.sortOrder)),
    db.select().from(lensColourOptions).orderBy(asc(lensColourOptions.sortOrder)),
  ]);
  return jsonOk({ sets, colours });
});

export const POST = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const body = await req.json();
  if (body.entity === 'set') {
    const [row] = await db.insert(lensColourSets).values(body.data).returning();
    return jsonOk(row, 201);
  }
  if (body.entity === 'colour') {
    const [row] = await db.insert(lensColourOptions).values(body.data).returning();
    return jsonOk(row, 201);
  }
  return jsonError('entity must be "set" or "colour"', 400);
});

export const PATCH = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const { entity, id, ...data } = await req.json();
  if (!id) return jsonError('id required', 400);
  if (entity === 'set') {
    const [row] = await db.update(lensColourSets).set(data).where(eq(lensColourSets.id, id)).returning();
    return jsonOk(row);
  }
  if (entity === 'colour') {
    const [row] = await db.update(lensColourOptions).set(data).where(eq(lensColourOptions.id, id)).returning();
    return jsonOk(row);
  }
  return jsonError('entity must be "set" or "colour"', 400);
});

export const DELETE = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const { entity, id } = await req.json();
  if (!id) return jsonError('id required', 400);
  if (entity === 'set') {
    await db.delete(lensColourOptions).where(eq(lensColourOptions.setId, id));
    await db.delete(lensColourSets).where(eq(lensColourSets.id, id));
    return jsonOk({ deleted: id });
  }
  if (entity === 'colour') {
    await db.delete(lensColourOptions).where(eq(lensColourOptions.id, id));
    return jsonOk({ deleted: id });
  }
  return jsonError('entity must be "set" or "colour"', 400);
});
