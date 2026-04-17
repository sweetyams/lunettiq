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
