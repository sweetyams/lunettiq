export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { ordersProjection, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { desc, sql, ilike, eq } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth('org:orders:read');
  const params = request.nextUrl.searchParams;
  const q = params.get('q') ?? '';
  const source = params.get('source');
  const limit = Math.min(Number(params.get('limit') ?? 50), 200);
  const offset = Number(params.get('offset') ?? 0);

  const conditions = [];
  if (q) conditions.push(sql`(${ordersProjection.orderNumber} ILIKE ${'%' + q + '%'} OR ${ordersProjection.shopifyCustomerId} IN (SELECT shopify_customer_id FROM customers_projection WHERE first_name ILIKE ${'%' + q + '%'} OR last_name ILIKE ${'%' + q + '%'} OR email ILIKE ${'%' + q + '%'}))`);
  if (source) conditions.push(eq(ordersProjection.source, source));

  const where = conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  const [orders, countResult] = await Promise.all([
    db.select().from(ordersProjection).where(where).orderBy(desc(ordersProjection.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(ordersProjection).where(where),
  ]);

  // Enrich with customer names
  const customerIds = Array.from(new Set(orders.map(o => o.shopifyCustomerId).filter(Boolean))) as string[];
  let custMap = new Map<string, { firstName: string | null; lastName: string | null; email: string | null }>();
  if (customerIds.length) {
    const { inArray } = await import('drizzle-orm');
    const customers = await db.select({ id: customersProjection.shopifyCustomerId, firstName: customersProjection.firstName, lastName: customersProjection.lastName, email: customersProjection.email })
      .from(customersProjection).where(inArray(customersProjection.shopifyCustomerId, customerIds));
    custMap = new Map(customers.map(c => [c.id, c]));
  }

  const enriched = orders.map(o => ({
    ...o,
    customerName: o.shopifyCustomerId ? `${custMap.get(o.shopifyCustomerId)?.firstName ?? ''} ${custMap.get(o.shopifyCustomerId)?.lastName ?? ''}`.trim() || custMap.get(o.shopifyCustomerId)?.email || null : null,
  }));

  return jsonOk({ orders: enriched, total: Number(countResult[0]?.count ?? 0) });
});
