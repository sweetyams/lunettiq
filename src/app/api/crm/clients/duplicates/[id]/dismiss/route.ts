import { db } from '@/lib/db';
import { duplicateCandidates } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const POST = handler(async (_request, ctx) => {
  await requireCrmAuth('org:clients:merge');
  const id = ctx.params.id;

  const [updated] = await db
    .update(duplicateCandidates)
    .set({ status: 'dismissed' })
    .where(eq(duplicateCandidates.id, id))
    .returning();

  if (!updated) return jsonError('Candidate not found', 404);
  return jsonOk(updated);
});
