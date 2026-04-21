export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { ordersProjection, productFeedback, customersProjection, productMappings } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql, desc } from 'drizzle-orm';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:products:read');
  const productId = ctx.params.id;

  // Get mapped Square names for this product
  const mappedRows = await db.select({ squareName: productMappings.squareName }).from(productMappings)
    .where(sql`${productMappings.shopifyProductId} = ${productId} AND ${productMappings.status} IN ('confirmed', 'auto', 'manual', 'related')`);
  const squareNames = mappedRows.map(r => r.squareName?.toLowerCase()).filter(Boolean) as string[];

  // --- Velocity: weekly units sold over 12 weeks ---
  const weeksAgo12 = new Date(Date.now() - 84 * 86400000).toISOString();
  const allOrders = await db.select({
    id: ordersProjection.shopifyOrderId,
    items: ordersProjection.lineItems,
    createdAt: ordersProjection.createdAt,
    customerId: ordersProjection.shopifyCustomerId,
    source: ordersProjection.source,
    locationId: ordersProjection.locationId,
  }).from(ordersProjection).where(sql`${ordersProjection.createdAt} >= ${weeksAgo12}`);

  // Filter to orders containing this product (by product_id OR Square name)
  const productOrders: Array<{ createdAt: string; customerId: string | null; qty: number; source: string; locationId: string | null }> = [];
  for (const o of allOrders) {
    const items = (o.items as any[]) ?? [];
    const match = items.filter((li: any) =>
      String(li.product_id) === productId ||
      (squareNames.length > 0 && squareNames.includes((li.name ?? '').toLowerCase()))
    );
    if (match.length) {
      productOrders.push({ createdAt: o.createdAt as any, customerId: o.customerId, qty: match.reduce((s: number, li: any) => s + (li.quantity ?? 1), 0), source: o.source ?? 'shopify', locationId: o.locationId });
    }
  }

  const now = Date.now();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = now - (12 - i) * 7 * 86400000;
    const end = start + 7 * 86400000;
    const units = productOrders.filter(o => { const t = new Date(o.createdAt).getTime(); return t >= start && t < end; }).reduce((s, o) => s + o.qty, 0);
    return { week: i + 1, units };
  });

  const d7 = productOrders.filter(o => new Date(o.createdAt).getTime() > now - 7 * 86400000).reduce((s, o) => s + o.qty, 0);
  const d30 = productOrders.filter(o => new Date(o.createdAt).getTime() > now - 30 * 86400000).reduce((s, o) => s + o.qty, 0);
  const d90 = productOrders.reduce((s, o) => s + o.qty, 0);

  // --- Sentiment from product_feedback ---
  const feedback = await db.select().from(productFeedback).where(eq(productFeedback.shopifyProductId, productId));
  const love = feedback.filter(f => f.sentiment === 'love' || f.sentiment === 'like').length;
  const neutral = feedback.filter(f => f.sentiment === 'neutral').length;
  const dislike = feedback.filter(f => f.sentiment === 'dislike').length;
  const totalFb = love + neutral + dislike;
  const totalTryOns = feedback.reduce((s, f) => s + (f.tryOnCount ?? 0), 0);

  // --- Pairs-with: co-purchased products (includes Square data) ---
  const buyerIds = Array.from(new Set(productOrders.map(o => o.customerId).filter(Boolean))) as string[];
  let pairsWith: Array<{ productId: string; title: string; count: number }> = [];
  if (buyerIds.length) {
    const buyerOrders = await db.select({ items: ordersProjection.lineItems }).from(ordersProjection)
      .where(sql`${ordersProjection.shopifyCustomerId} IN (${sql.join(buyerIds.map(id => sql`${id}`), sql`, `)})`);
    const coProducts = new Map<string, { title: string; count: number }>();
    for (const o of buyerOrders) {
      for (const li of (o.items as any[]) ?? []) {
        const pid = String(li.product_id ?? '');
        const liName = (li.name ?? '').toLowerCase();
        // Skip self
        if (pid === productId || squareNames.includes(liName)) continue;
        if (!pid && !li.name) continue;
        const key = pid || liName;
        const title = li.name?.split(' - ')[0] ?? li.title ?? key;
        const existing = coProducts.get(key);
        if (existing) existing.count++;
        else coProducts.set(key, { title, count: 1 });
      }
    }
    pairsWith = Array.from(coProducts.entries()).map(([id, v]) => ({ productId: id, ...v })).sort((a, b) => b.count - a.count).slice(0, 8);
  }

  // --- Sales by channel ---
  const salesByChannel: Record<string, { orders: number; units: number }> = {};
  for (const o of productOrders) {
    const ch = o.source ?? 'shopify';
    if (!salesByChannel[ch]) salesByChannel[ch] = { orders: 0, units: 0 };
    salesByChannel[ch].orders++;
    salesByChannel[ch].units += o.qty;
  }

  // --- Sales by location (with resolved names) ---
  const { getLocationNames } = await import('@/lib/crm/location-names');
  const locNames = await getLocationNames();
  const salesByLocation: Record<string, { orders: number; units: number }> = {};
  for (const o of productOrders) {
    const locId = o.locationId ?? 'online';
    const name = locNames.get(locId) ?? locId;
    if (!salesByLocation[name]) salesByLocation[name] = { orders: 0, units: 0 };
    salesByLocation[name].orders++;
    salesByLocation[name].units += o.qty;
  }

  // --- Hot clients: loved but not purchased ---
  const lovedFb = feedback.filter(f => f.sentiment === 'love' || f.sentiment === 'like');
  const purchaserIds = new Set(buyerIds);
  const hotIds = lovedFb.map(f => f.shopifyCustomerId).filter(id => !purchaserIds.has(id));
  let hotClients: Array<{ id: string; name: string; email: string | null; ltv: string; tier: string | null; lastInteraction: string | null }> = [];
  if (hotIds.length) {
    const clients = await db.select().from(customersProjection)
      .where(sql`${customersProjection.shopifyCustomerId} IN (${sql.join(hotIds.map(id => sql`${id}`), sql`, `)})`);
    hotClients = clients.map(c => ({
      id: c.shopifyCustomerId,
      name: [c.firstName, c.lastName].filter(Boolean).join(' '),
      email: c.email,
      ltv: c.totalSpent ?? '0',
      tier: (c.tags ?? []).find(t => t.startsWith('member-'))?.replace('member-', '') ?? null,
      lastInteraction: null,
    })).sort((a, b) => Number(b.ltv) - Number(a.ltv)).slice(0, 10);
  }

  return jsonOk({
    velocity: { weeks, d7, d30, d90 },
    sentiment: { love, neutral, dislike, total: totalFb, tryOns: totalTryOns },
    pairsWith,
    hotClients,
    salesByChannel,
    salesByLocation,
  });
});
