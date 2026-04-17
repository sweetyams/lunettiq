import { db } from '@/lib/db';
import { customersProjection, ordersProjection, preferencesDerived, productFeedback, tryOnSessions, clientLinks, creditsLedger } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/crm/auth';
import { ClientCanvas } from './ClientCanvas';

export default async function ClientProfilePage({ params }: { params: { id: string } }) {
  await requirePermission('org:clients:read');
  const { id } = params;

  const [client, orders, prefs, feedback, sessions, links, creditRows] = await Promise.all([
    db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]),
    db.select().from(ordersProjection).where(eq(ordersProjection.shopifyCustomerId, id)).orderBy(desc(ordersProjection.createdAt)).limit(50),
    db.select().from(preferencesDerived).where(eq(preferencesDerived.shopifyCustomerId, id)).then(r => r[0]),
    db.select().from(productFeedback).where(eq(productFeedback.shopifyCustomerId, id)),
    db.select().from(tryOnSessions).where(eq(tryOnSessions.shopifyCustomerId, id)).orderBy(desc(tryOnSessions.startedAt)).limit(10),
    db.select({ a: clientLinks.clientA, b: clientLinks.clientB, rel: clientLinks.relationship, id: clientLinks.id })
      .from(clientLinks).where(sql`${clientLinks.clientA} = ${id} OR ${clientLinks.clientB} = ${id}`),
    db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(creditsLedger).where(eq(creditsLedger.shopifyCustomerId, id)),
  ]);

  if (!client) notFound();

  // Derived stats
  let totalItems = 0, returnedItems = 0;
  const productIds = new Set<string>();
  for (const o of orders) {
    const items = (o.lineItems as any[]) ?? [];
    totalItems += items.length;
    returnedItems += items.filter((li: any) => li.returned).length;
    items.forEach((li: any) => { if (li.product_id) productIds.add(li.product_id); });
  }
  const returnRate = totalItems > 0 ? Math.round((returnedItems / totalItems) * 100) : 0;
  const daysIdle = orders[0]?.createdAt ? Math.round((Date.now() - new Date(orders[0].createdAt).getTime()) / 86400000) : null;
  const orderCount = client.orderCount ?? orders.length;
  const avgSpend = orderCount > 0 ? Math.round(Number(client.totalSpent ?? 0) / orderCount) : 0;
  const pairsOwned = productIds.size;
  const creditBalance = Math.round(Number(creditRows[0]?.total ?? 0));

  // Cadence: avg days between orders
  let cadence: number | null = null;
  if (orders.length >= 2) {
    const sorted = orders.filter(o => o.createdAt).map(o => new Date(o.createdAt!).getTime()).sort((a, b) => b - a);
    const diffs = sorted.slice(0, -1).map((t, i) => (t - sorted[i + 1]) / 86400000);
    cadence = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }

  return (
    <ClientCanvas
      client={JSON.parse(JSON.stringify(client))}
      orders={JSON.parse(JSON.stringify(orders))}
      derived={prefs ? JSON.parse(JSON.stringify(prefs)) : null}
      feedback={JSON.parse(JSON.stringify(feedback))}
      sessions={JSON.parse(JSON.stringify(sessions))}
      links={JSON.parse(JSON.stringify(links))}
      stats={{ returnRate, daysIdle, avgSpend, pairsOwned, cadence, creditBalance, orderCount }}
    />
  );
}
