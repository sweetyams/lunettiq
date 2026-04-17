import { db } from '@/lib/db';
import { duplicateCandidates, customersProjection } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { DuplicatesClient } from './DuplicatesClient';
import { requirePermission } from '@/lib/crm/auth';

export default async function DuplicatesPage() {
  await requirePermission('org:clients:merge');
  const rows = await db.select().from(duplicateCandidates).where(eq(duplicateCandidates.status, 'pending')).limit(50);

  if (!rows.length) return <DuplicatesClient pairs={[]} />;

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

  const map = new Map(clients.map(c => [c.id, c]));
  const pairs = rows.map(r => ({
    id: r.id,
    matchReason: r.matchReason,
    confidence: r.confidence,
    clientA: map.get(r.clientA) ?? null,
    clientB: map.get(r.clientB) ?? null,
  }));

  return <DuplicatesClient pairs={JSON.parse(JSON.stringify(pairs))} />;
}
