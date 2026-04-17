export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { customersProjection, ordersProjection, productsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql, desc, gte } from 'drizzle-orm';

export const GET = handler(async () => {
  const session = await requireCrmAuth();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalClients, ordersThisMonth, revenueThisMonth, topByLtv] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customersProjection).then(r => Number(r[0]?.count ?? 0)),
    db.select({ count: sql<number>`count(*)` }).from(ordersProjection).where(gte(ordersProjection.createdAt, monthStart)).then(r => Number(r[0]?.count ?? 0)),
    db.select({ total: sql<string>`coalesce(sum(${ordersProjection.totalPrice}), 0)` }).from(ordersProjection).where(gte(ordersProjection.createdAt, monthStart)).then(r => r[0]?.total ?? '0'),
    db.select({
      id: customersProjection.shopifyCustomerId,
      firstName: customersProjection.firstName,
      lastName: customersProjection.lastName,
      totalSpent: customersProjection.totalSpent,
      orderCount: customersProjection.orderCount,
    }).from(customersProjection).orderBy(desc(sql`${customersProjection.totalSpent}::numeric`)).limit(10),
  ]);

  return jsonOk({ totalClients, ordersThisMonth, revenueThisMonth, topByLtv, role: session.role, locationIds: session.locationIds });
});
