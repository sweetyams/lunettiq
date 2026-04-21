export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productFeedback, customersProjection, ordersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';
import { getProductSales } from '@/lib/crm/product-sales';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:products:read');
  const productId = ctx.params.id;

  // Sales data from centralized service
  const sales = await getProductSales(productId);

  // Sentiment from product_feedback
  const feedback = await db.select().from(productFeedback).where(eq(productFeedback.shopifyProductId, productId));
  const love = feedback.filter(f => f.sentiment === 'love' || f.sentiment === 'like').length;
  const neutral = feedback.filter(f => f.sentiment === 'neutral').length;
  const dislike = feedback.filter(f => f.sentiment === 'dislike').length;
  const totalFb = love + neutral + dislike;
  const totalTryOns = feedback.reduce((s, f) => s + (f.tryOnCount ?? 0), 0);

  // Pairs-with: co-purchased products
  const buyerIds = new Set<string>();
  const squareNames = await db.execute(sql`
    SELECT lower(trim(square_name)) as name FROM product_mappings
    WHERE shopify_product_id = ${productId} AND status IN ('confirmed','auto','manual','related') AND square_name IS NOT NULL
  `).then(r => (r.rows as any[]).map(row => row.name).filter(Boolean));

  const matchCond = squareNames.length
    ? sql`(item->>'product_id' = ${productId} OR lower(trim(item->>'name')) IN (${sql.join(squareNames.map(n => sql`${n}`), sql`, `)}))`
    : sql`item->>'product_id' = ${productId}`;

  const buyerRows = await db.execute(sql`
    SELECT DISTINCT o.shopify_customer_id FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE ${matchCond} AND o.shopify_customer_id IS NOT NULL
  `);
  for (const r of buyerRows.rows as any[]) buyerIds.add(r.shopify_customer_id);

  let pairsWith: Array<{ productId: string; title: string; count: number }> = [];
  if (buyerIds.size > 0) {
    const ids = Array.from(buyerIds);
    const buyerOrders = await db.select({ items: ordersProjection.lineItems }).from(ordersProjection)
      .where(sql`${ordersProjection.shopifyCustomerId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
    const coProducts = new Map<string, { title: string; count: number }>();
    for (const o of buyerOrders) {
      for (const li of (o.items as any[]) ?? []) {
        const pid = String(li.product_id ?? '');
        const liName = (li.name ?? '').toLowerCase().trim();
        if (pid === productId || squareNames.includes(liName)) continue;
        if (!pid && !li.name) continue;
        const key = pid || liName;
        const title = li.name?.split(' - ')[0] ?? key;
        const existing = coProducts.get(key);
        if (existing) existing.count++; else coProducts.set(key, { title, count: 1 });
      }
    }
    pairsWith = Array.from(coProducts.entries()).map(([id, v]) => ({ productId: id, ...v })).sort((a, b) => b.count - a.count).slice(0, 8);
  }

  // Hot clients: loved but not purchased
  const lovedFb = feedback.filter(f => f.sentiment === 'love' || f.sentiment === 'like');
  const purchaserIds = buyerIds;
  const hotIds = lovedFb.map(f => f.shopifyCustomerId).filter(id => !purchaserIds.has(id));
  let hotClients: Array<{ id: string; name: string; email: string | null; ltv: string; tier: string | null }> = [];
  if (hotIds.length) {
    const clients = await db.select().from(customersProjection)
      .where(sql`${customersProjection.shopifyCustomerId} IN (${sql.join(hotIds.map(id => sql`${id}`), sql`, `)})`);
    hotClients = clients.map(c => ({
      id: c.shopifyCustomerId,
      name: [c.firstName, c.lastName].filter(Boolean).join(' '),
      email: c.email,
      ltv: c.totalSpent ?? '0',
      tier: (c.tags ?? []).find(t => t.startsWith('member-'))?.replace('member-', '') ?? null,
    })).sort((a, b) => Number(b.ltv) - Number(a.ltv)).slice(0, 10);
  }

  // Square mappings for display
  const squareMappings = await db.execute(sql`
    SELECT square_name, status FROM product_mappings
    WHERE shopify_product_id = ${productId} AND status IN ('confirmed','auto','manual','related')
  `).then(r => r.rows);

  return jsonOk({
    velocity: sales.velocity,
    sentiment: { love, neutral, dislike, total: totalFb, tryOns: totalTryOns },
    pairsWith,
    hotClients,
    salesByChannel: Object.fromEntries(sales.byChannel.map(c => [c.source, { orders: c.orders, units: c.units }])),
    salesByLocation: Object.fromEntries(sales.byLocation.map(l => [l.locationId, { orders: l.orders, units: l.units }])),
    squareMappings,
    salesSummary: { direct: sales.direct, square: sales.square, total: sales.total },
  });
});
