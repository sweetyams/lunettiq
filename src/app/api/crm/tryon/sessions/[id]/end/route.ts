import { db } from '@/lib/db';
import { tryOnSessions } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const POST = handler(async (request, ctx) => {
  await requireCrmAuth('org:tryon:initiate');
  const { outcomeTag, notes } = await request.json();

  await db.update(tryOnSessions)
    .set({ endedAt: new Date(), outcomeTag, notes })
    .where(eq(tryOnSessions.id, ctx.params.id));

  return jsonOk({ ok: true });
});
