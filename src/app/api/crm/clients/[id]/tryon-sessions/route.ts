export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { tryOnSessions } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc } from 'drizzle-orm';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:tryon:view_history');

  const rows = await db.select()
    .from(tryOnSessions)
    .where(eq(tryOnSessions.shopifyCustomerId, ctx.params.id))
    .orderBy(desc(tryOnSessions.startedAt))
    .limit(20);

  return jsonOk(rows);
});

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:clients:update');
  const body = await request.json();

  const [row] = await db.insert(tryOnSessions).values({
    shopifyCustomerId: ctx.params.id,
    staffId: session.userId,
    locationId: body.locationId ?? session.locationIds[0],
    framesTried: body.framesTried ?? 0,
    outcomeTag: body.outcomeTag ?? null,
    notes: body.notes ?? null,
    endedAt: body.endedAt ? new Date(body.endedAt) : null,
  }).returning();

  return jsonOk(row, 201);
});
