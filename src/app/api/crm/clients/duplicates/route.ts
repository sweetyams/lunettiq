export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { duplicateCandidates, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, inArray } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth('org:clients:read');

  const rows = await db
    .select()
    .from(duplicateCandidates)
    .where(eq(duplicateCandidates.status, 'pending'))
    .orderBy(duplicateCandidates.createdAt)
    .limit(50);

  if (!rows.length) return jsonOk([]);

  const ids = Array.from(new Set(rows.flatMap(r => [r.clientA, r.clientB])));
  const clients = await db
    .select({
      id: customersProjection.shopifyCustomerId,
      firstName: customersProjection.firstName,
      lastName: customersProjection.lastName,
      email: customersProjection.email,
      phone: customersProjection.phone,
      orderCount: customersProjection.orderCount,
      totalSpent: customersProjection.totalSpent,
      tags: customersProjection.tags,
    })
    .from(customersProjection)
    .where(inArray(customersProjection.shopifyCustomerId, ids));

  const clientMap = new Map(clients.map(c => [c.id, c]));

  const pairs = rows.map(r => ({
    id: r.id,
    matchReason: r.matchReason,
    confidence: r.confidence,
    clientA: clientMap.get(r.clientA) ?? { id: r.clientA },
    clientB: clientMap.get(r.clientB) ?? { id: r.clientB },
  }));

  return jsonOk(pairs);
});
