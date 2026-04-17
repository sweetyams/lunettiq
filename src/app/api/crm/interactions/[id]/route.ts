export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { interactions } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { writeAudit } from '@/lib/crm/audit';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const PATCH = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:interactions:update');
  const id = ctx.params.id;
  const body = await request.json();

  const existing = await db.select().from(interactions).where(eq(interactions.id, id)).then(r => r[0]);
  if (!existing) return jsonError('Not found', 404);

  const updates: Record<string, unknown> = {};
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.body !== undefined) updates.body = body.body;
  if (body.type !== undefined) updates.type = body.type;

  const [row] = await db.update(interactions).set(updates).where(eq(interactions.id, id)).returning();
  await writeAudit({ session, action: 'update', entityType: 'interaction', entityId: id, diff: body });
  return jsonOk(row);
});

export const DELETE = handler(async (_request, ctx) => {
  const session = await requireCrmAuth('org:interactions:delete');
  const id = ctx.params.id;
  await db.delete(interactions).where(eq(interactions.id, id));
  await writeAudit({ session, action: 'delete', entityType: 'interaction', entityId: id });
  return jsonOk({ deleted: true });
});
