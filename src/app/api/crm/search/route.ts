import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection, productsProjection, ordersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { ilike, or, sql } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth();
  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (!q.trim()) return jsonOk({ clients: [], products: [], orders: [] });

  const pattern = `%${q}%`;

  const [clients, products, orders] = await Promise.all([
    db.select({
      shopifyCustomerId: customersProjection.shopifyCustomerId,
      firstName: customersProjection.firstName,
      lastName: customersProjection.lastName,
      email: customersProjection.email,
    }).from(customersProjection).where(
      or(
        ilike(customersProjection.firstName, pattern),
        ilike(customersProjection.lastName, pattern),
        ilike(customersProjection.email, pattern),
        ilike(customersProjection.phone, pattern),
        sql`concat(${customersProjection.firstName}, ' ', ${customersProjection.lastName}) ILIKE ${pattern}`,
      )
    ).limit(8),
    db.select({
      shopifyProductId: productsProjection.shopifyProductId,
      title: productsProjection.title,
      vendor: productsProjection.vendor,
    }).from(productsProjection).where(ilike(productsProjection.title, pattern)).limit(8),
    db.select({
      shopifyOrderId: ordersProjection.shopifyOrderId,
      orderNumber: ordersProjection.orderNumber,
      totalPrice: ordersProjection.totalPrice,
    }).from(ordersProjection).where(ilike(ordersProjection.orderNumber, pattern)).limit(8),
  ]);

  return jsonOk({ clients, products, orders });
});
