export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { draftOrdersProjection, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { desc, sql, eq } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth('org:orders:read');
  const params = request.nextUrl.searchParams;
  const q = params.get('q') ?? '';
  const status = params.get('status');
  const limit = Math.min(Number(params.get('limit') ?? 50), 200);
  const offset = Number(params.get('offset') ?? 0);

  const conditions = [];
  if (q) conditions.push(sql`(${draftOrdersProjection.name} ILIKE ${'%' + q + '%'} OR ${draftOrdersProjection.email} ILIKE ${'%' + q + '%'})`);
  if (status) conditions.push(eq(draftOrdersProjection.status, status));

  const where = conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  const [drafts, countResult] = await Promise.all([
    db.select().from(draftOrdersProjection).where(where).orderBy(desc(draftOrdersProjection.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(draftOrdersProjection).where(where),
  ]);

  // Enrich with customer names
  const customerIds = drafts.map(d => d.shopifyCustomerId).filter(Boolean) as string[];
  let custMap = new Map<string, { firstName: string | null; lastName: string | null; email: string | null }>();
  if (customerIds.length) {
    const { inArray } = await import('drizzle-orm');
    const customers = await db.select({ id: customersProjection.shopifyCustomerId, firstName: customersProjection.firstName, lastName: customersProjection.lastName, email: customersProjection.email })
      .from(customersProjection).where(inArray(customersProjection.shopifyCustomerId, customerIds));
    custMap = new Map(customers.map(c => [c.id, c]));
  }

  const enriched = drafts.map(d => ({
    ...d,
    customerName: d.shopifyCustomerId
      ? `${custMap.get(d.shopifyCustomerId)?.firstName ?? ''} ${custMap.get(d.shopifyCustomerId)?.lastName ?? ''}`.trim() || d.email || null
      : d.email || null,
  }));

  return jsonOk({ draftOrders: enriched, total: Number(countResult[0]?.count ?? 0) });
});
