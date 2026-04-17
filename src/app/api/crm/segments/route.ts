import { db } from '@/lib/db';
import { segments } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonList, jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { desc } from 'drizzle-orm';
import { evaluateSegmentRules } from '@/lib/crm/segment-rules';

export const GET = handler(async () => {
  await requireCrmAuth('org:segments:read');
  const rows = await db.select().from(segments).orderBy(desc(segments.updatedAt));
  return jsonList(rows, { total: rows.length, limit: rows.length, offset: 0 });
});

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:segments:create');
  const body = await request.json();

  const count = await evaluateSegmentRules(body.rules);
  if (count === null) return jsonError('Invalid rule field', 400);

  const [row] = await db.insert(segments).values({
    name: body.name,
    description: body.description,
    rules: body.rules,
    memberCount: count,
    createdBy: session.userId,
  }).returning();

  return jsonOk(row, 201);
});
