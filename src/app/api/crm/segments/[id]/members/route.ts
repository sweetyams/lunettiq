import { db } from '@/lib/db';
import { segments } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { getSegmentMembers } from '@/lib/crm/segment-rules';
import { eq } from 'drizzle-orm';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:segments:read');

  const segment = await db.select().from(segments).where(eq(segments.id, ctx.params.id)).then(r => r[0]);
  if (!segment) return jsonError('Segment not found', 404);

  const members = await getSegmentMembers(segment.rules as { logic: string; conditions: Array<{ field: string; operator: string; value: string }> });
  return jsonOk(members);
});
