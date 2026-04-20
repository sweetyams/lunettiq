export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { appointmentTypes } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, asc } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth('org:appointments:read');
  const rows = await db.select().from(appointmentTypes).orderBy(asc(appointmentTypes.sortOrder));
  return jsonOk(rows);
});

export const POST = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const body = await req.json();
  if (!body.name) return jsonError('name is required', 400);
  const [row] = await db.insert(appointmentTypes).values({
    name: body.name,
    durationMinutes: body.durationMinutes ?? 30,
    bufferMinutes: body.bufferMinutes ?? 0,
    sortOrder: body.sortOrder ?? 0,
  }).returning();
  return jsonOk(row, 201);
});
