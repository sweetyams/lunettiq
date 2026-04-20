export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { appointmentTypes } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const PATCH = handler(async (req, ctx) => {
  await requireCrmAuth('org:settings:business_config');
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
  if (body.bufferMinutes !== undefined) updates.bufferMinutes = body.bufferMinutes;
  if (body.active !== undefined) updates.active = body.active;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  const [row] = await db.update(appointmentTypes).set(updates).where(eq(appointmentTypes.id, ctx.params.id)).returning();
  if (!row) return jsonError('Not found', 404);
  return jsonOk(row);
});

export const DELETE = handler(async (_req, ctx) => {
  await requireCrmAuth('org:settings:business_config');
  await db.delete(appointmentTypes).where(eq(appointmentTypes.id, ctx.params.id));
  return jsonOk({ deleted: true });
});
