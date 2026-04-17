export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const GET = handler(async (request) => {
  await requireCrmAuth('org:clients:export_bulk');
  const tag = new URL(request.url).searchParams.get('tag');

  const clients = tag
    ? await db.select().from(customersProjection).where(sql`${tag} = ANY(${customersProjection.tags})`)
    : await db.select().from(customersProjection);

  const header = 'shopifyCustomerId,firstName,lastName,email,phone,orderCount,totalSpent,tags';
  const rows = clients.map(c =>
    [c.shopifyCustomerId, c.firstName, c.lastName, c.email, c.phone, c.orderCount, c.totalSpent, `"${(c.tags ?? []).join(';')}"`].join(',')
  );

  return new NextResponse([header, ...rows].join('\n'), {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="clients-export.csv"' },
  }) as any;
});
