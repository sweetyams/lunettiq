import { db } from '@/lib/db';
import { customersProjection, ordersProjection, interactions } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const GET = handler(async (request, ctx) => {
  await requireCrmAuth('org:clients:export_single');
  const id = ctx.params.id;
  const format = new URL(request.url).searchParams.get('format') ?? 'json';

  const [client, orders, timeline] = await Promise.all([
    db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]),
    db.select().from(ordersProjection).where(eq(ordersProjection.shopifyCustomerId, id)),
    db.select().from(interactions).where(eq(interactions.shopifyCustomerId, id)),
  ]);

  if (!client) return jsonError('Client not found', 404);

  if (format === 'csv') {
    const headers = Object.keys(client).join(',');
    const values = Object.values(client).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    return new NextResponse(`${headers}\n${values}`, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="client-${id}.csv"` },
    }) as any;
  }

  return jsonOk({ client, orders, interactions: timeline });
});
