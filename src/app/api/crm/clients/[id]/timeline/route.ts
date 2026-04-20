export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { interactions, ordersProjection, creditsLedger, appointments, productsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc, and, lt, sql } from 'drizzle-orm';

interface TimelineEntry {
  id: string;
  type: string;
  date: string;
  summary: string;
  details?: Record<string, unknown>;
}

export const GET = handler(async (request, ctx) => {
  await requireCrmAuth('org:interactions:read');
  const customerId = ctx.params.id;
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter')?.split(',').filter(Boolean) ?? [];
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const cursorDate = cursor ? new Date(cursor) : null;

  const entries: TimelineEntry[] = [];
  const shouldInclude = (type: string) => !filter.length || filter.includes(type);

  // Interactions (notes, calls, visits)
  if (shouldInclude('note') || shouldInclude('call') || shouldInclude('visit')) {
    const rows = await db.select().from(interactions)
      .where(and(eq(interactions.shopifyCustomerId, customerId), cursorDate ? lt(interactions.occurredAt, cursorDate) : undefined))
      .orderBy(desc(interactions.occurredAt)).limit(limit);
    for (const r of rows) {
      entries.push({
        id: `int-${r.id}`, type: r.type ?? 'note', date: (r.occurredAt ?? new Date()).toISOString(),
        summary: r.subject || r.body?.slice(0, 100) || r.type || 'Interaction',
        details: { body: r.body, staffId: r.staffId, direction: r.direction, metadata: r.metadata },
      });
    }
  }

  // Orders
  if (shouldInclude('order')) {
    const rows = await db.select().from(ordersProjection)
      .where(and(eq(ordersProjection.shopifyCustomerId, customerId), cursorDate ? lt(ordersProjection.createdAt, cursorDate) : undefined))
      .orderBy(desc(ordersProjection.createdAt)).limit(limit);
    for (const r of rows) {
      entries.push({
        id: `ord-${r.shopifyOrderId}`, type: 'order', date: (r.createdAt ?? new Date()).toISOString(),
        summary: `Order #${r.orderNumber} · $${r.totalPrice}`,
        details: { orderNumber: r.orderNumber, totalPrice: r.totalPrice, financialStatus: r.financialStatus, fulfillmentStatus: r.fulfillmentStatus, lineItems: r.lineItems },
      });
    }
  }

  // Credits
  if (shouldInclude('credit')) {
    const rows = await db.select().from(creditsLedger)
      .where(and(eq(creditsLedger.shopifyCustomerId, customerId), cursorDate ? lt(creditsLedger.occurredAt, cursorDate) : undefined))
      .orderBy(desc(creditsLedger.occurredAt)).limit(limit);
    for (const r of rows) {
      entries.push({
        id: `crd-${r.id}`, type: 'credit', date: (r.occurredAt ?? new Date()).toISOString(),
        summary: `${Number(r.amount) >= 0 ? '+' : ''}$${r.amount} — ${r.reason || r.transactionType}`,
        details: { amount: r.amount, type: r.transactionType, reason: r.reason },
      });
    }
  }

  // Appointments
  if (shouldInclude('appointment')) {
    const rows = await db.select().from(appointments)
      .where(and(eq(appointments.shopifyCustomerId, customerId), cursorDate ? lt(appointments.startsAt, cursorDate) : undefined))
      .orderBy(desc(appointments.startsAt)).limit(limit);
    for (const r of rows) {
      entries.push({
        id: `apt-${r.id}`, type: 'appointment', date: (r.startsAt ?? new Date()).toISOString(),
        summary: `${r.title ?? 'Appointment'} — ${r.status}`,
        details: { status: r.status, staffId: r.staffId, locationId: r.locationId, notes: r.notes },
      });
    }
  }

  // Sort all by date desc, take limit
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const page = entries.slice(0, limit);

  // Enrich recommendation entries with product images
  const recProductIds = page.filter(e => e.details?.metadata && (e.details.metadata as any).productId).map(e => (e.details!.metadata as any).productId);
  if (recProductIds.length) {
    const products = await db.select({ id: productsProjection.shopifyProductId, images: productsProjection.images })
      .from(productsProjection)
      .where(sql`${productsProjection.shopifyProductId} = ANY(ARRAY[${sql.join(recProductIds.map((id: string) => sql`${id}`), sql`, `)}])`);
    const imgMap = new Map(products.map(p => {
      const imgs = (p.images ?? []) as Array<string | { src?: string }>;
      const img = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;
      return [p.id, img];
    }));
    for (const e of page) {
      const pid = (e.details?.metadata as any)?.productId;
      if (pid && imgMap.has(pid)) (e.details as any).productImageUrl = imgMap.get(pid);
    }
  }

  const nextCursor = page.length === limit ? page[page.length - 1].date : null;

  return jsonOk({ data: page, nextCursor });
});
