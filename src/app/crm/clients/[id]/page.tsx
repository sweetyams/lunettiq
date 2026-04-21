import { db } from '@/lib/db';
import { customersProjection, ordersProjection, preferencesDerived, productFeedback, tryOnSessions, clientLinks, creditsLedger, productsProjection } from '@/lib/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/crm/auth';
import { getLocationNames } from '@/lib/crm/location-names';
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

  // Enrich line items and feedback with product images/names
  const allProducts = await db.select({
    id: productsProjection.shopifyProductId,
    title: productsProjection.title,
    images: productsProjection.images,
  }).from(productsProjection);

  // Build lookup maps
  const productById = new Map<string, { title: string; imageUrl: string | null }>();
  const productByTitle = new Map<string, { title: string; imageUrl: string | null }>();
  for (const p of allProducts) {
    const imgs = (p.images ?? []) as Array<string | { src?: string }>;
    const img = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;
    const entry = { title: p.title ?? '', imageUrl: img };
    productById.set(p.id, entry);
    if (p.title) productByTitle.set(p.title.toUpperCase(), entry);
  }

  // Load product mappings for Square item resolution
  const { productMappings: productMappingsTable } = await import('@/lib/db/schema');
  const mappings = await db.select().from(productMappingsTable).where(
    sql`${productMappingsTable.status} IN ('confirmed', 'auto', 'manual', 'related') AND ${productMappingsTable.shopifyProductId} IS NOT NULL`
  );
  const mappingByName = new Map<string, { shopifyProductId: string; status: string }>();
  for (const m of mappings) {
    if (m.squareName) mappingByName.set(m.squareName.toLowerCase(), { shopifyProductId: m.shopifyProductId!, status: m.status! });
  }

  // Enrich line items: match by title or product mapping
  for (const o of orders) {
    for (const li of ((o.lineItems as any[]) ?? [])) {
      if (li.name) {
        const matchKey = li.name.split(' - ')[0].trim().toUpperCase();
        const match = productByTitle.get(matchKey);
        if (match) { li.imageUrl = match.imageUrl; li.productTitle = match.title; }
        else {
          // Try product mapping (Square items)
          const mapping = mappingByName.get(li.name.toLowerCase());
          if (mapping) {
            const mapped = productById.get(mapping.shopifyProductId);
            if (mapped) {
              li.imageUrl = mapped.imageUrl;
              li.productTitle = mapped.title;
              li.mappingStatus = mapping.status; // 'confirmed'|'related'
            }
          }
        }
      }
    }
  }

  // Enrich feedback with product names and images
  const enrichedFeedback = feedback.map((f: any) => {
    const match = productById.get(f.shopifyProductId);
    return { ...f, productTitle: match?.title ?? null, imageUrl: match?.imageUrl ?? null };
  });

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

  // Enrich links with names
  const linkedIds = links.map(l => l.a === id ? l.b : l.a);
  const linkedClients = linkedIds.length > 0
    ? await db.select({ id: customersProjection.shopifyCustomerId, firstName: customersProjection.firstName, lastName: customersProjection.lastName, email: customersProjection.email })
        .from(customersProjection).where(inArray(customersProjection.shopifyCustomerId, linkedIds))
    : [];
  const nameMap = new Map(linkedClients.map(c => {
    const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
    return [c.id, name || c.email || `Client #${c.id.slice(-6)}`];
  }));
  const enrichedLinks = links.map(l => {
    const otherId = l.a === id ? l.b : l.a;
    return { ...l, otherName: nameMap.get(otherId) ?? otherId.slice(0, 12) };
  });

  const locationNames = await getLocationNames();

  return (
    <ClientCanvas
      client={JSON.parse(JSON.stringify(client))}
      orders={JSON.parse(JSON.stringify(orders))}
      derived={prefs ? JSON.parse(JSON.stringify(prefs)) : null}
      feedback={JSON.parse(JSON.stringify(enrichedFeedback))}
      sessions={JSON.parse(JSON.stringify(sessions))}
      links={JSON.parse(JSON.stringify(enrichedLinks))}
      stats={{ returnRate, daysIdle, avgSpend, pairsOwned, cadence, creditBalance, orderCount }}
      locationMap={Object.fromEntries(locationNames) as any}
    />
  );
}
