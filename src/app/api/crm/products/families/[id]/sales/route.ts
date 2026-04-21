export const dynamic = "force-dynamic";
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { getFamilySales } from '@/lib/crm/product-sales';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:products:read');
  const familyId = ctx.params.id;
  const days = Number(_request.nextUrl.searchParams.get('days') ?? 0);
  const sinceDate = days > 0 ? new Date(Date.now() - days * 86400000) : undefined;

  const sales = await getFamilySales(familyId, sinceDate);

  return jsonOk({
    familyId: sales.familyId,
    members: sales.members,
    familyOnlySquare: sales.squareOnly.map(s => ({ square_name: s.squareName, ...s.sales })),
    totals: sales.totals,
    byChannel: sales.byChannel.map(c => ({ source: c.source, units: c.units, orders: c.orders, revenue: c.revenue })),
    byLocation: sales.byLocation,
  });
});
