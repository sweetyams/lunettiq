export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';

/**
 * GET /api/crm/products/families/[id]/sales
 * Returns sales breakdown for a family: per-product, per-channel, per-location, totals.
 */
export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:products:read');
  const familyId = ctx.params.id;

  // Get all product IDs and Square names linked to this family
  const members = await db.execute(sql`
    SELECT m.product_id, m.type, m.colour, p.title, p.handle, p.images->0->>'src' as image
    FROM product_family_members m
    JOIN products_projection p ON p.shopify_product_id = m.product_id
    WHERE m.family_id = ${familyId}
    ORDER BY m.sort_order
  `);

  const squareMappings = await db.execute(sql`
    SELECT pm.shopify_product_id, pm.family_id, pm.square_name, pm.square_catalog_id
    FROM product_mappings pm
    WHERE (pm.family_id = ${familyId} OR pm.shopify_product_id IN (
      SELECT product_id FROM product_family_members WHERE family_id = ${familyId}
    ))
    AND pm.status IN ('confirmed', 'auto', 'manual', 'related')
  `);

  const productIds = members.rows.map((m: any) => m.product_id);
  const squareNames = squareMappings.rows.map((s: any) => (s.square_name ?? '').toLowerCase()).filter(Boolean);

  if (!productIds.length && !squareNames.length) {
    return jsonOk({ familyId, members: [], totals: { orders: 0, units: 0, revenue: 0 }, byChannel: [], byLocation: [], byProduct: [] });
  }

  // Build match condition
  const pidList = productIds.map((id: string) => sql`${id}`);
  const sqList = squareNames.map((n: string) => sql`${n}`);
  const matchCondition = sql`(
    ${pidList.length ? sql`item->>'product_id' IN (${sql.join(pidList, sql`, `)})` : sql`false`}
    OR ${sqList.length ? sql`lower(item->>'name') IN (${sql.join(sqList, sql`, `)})` : sql`false`}
  )`;

  // Per-product sales
  const byProduct = await db.execute(sql`
    SELECT
      item->>'product_id' as product_id,
      lower(item->>'name') as item_name,
      count(*) as units,
      count(DISTINCT o.shopify_order_id) as orders,
      coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE ${matchCondition}
    GROUP BY 1, 2
  `);

  // By channel
  const byChannel = await db.execute(sql`
    SELECT o.source, count(DISTINCT o.shopify_order_id) as orders,
      count(*) as units,
      coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE ${matchCondition}
    GROUP BY o.source
  `);

  // By location
  const byLocation = await db.execute(sql`
    SELECT coalesce(o.location_id, 'online') as location_id, count(DISTINCT o.shopify_order_id) as orders,
      count(*) as units,
      coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE ${matchCondition}
    GROUP BY 1
  `);

  // Totals
  const totals = await db.execute(sql`
    SELECT count(DISTINCT o.shopify_order_id) as orders,
      count(*) as units,
      coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE ${matchCondition}
  `);

  // Map product sales back to family members
  const productSales = new Map<string, { units: number; orders: number; revenue: number }>();
  for (const row of byProduct.rows as any[]) {
    // Match by product_id or square name
    const pid = row.product_id;
    const name = row.item_name;
    let matchedMember = pid ? productIds.find(id => id === pid) : null;
    if (!matchedMember && name) {
      // Find which member this square name belongs to
      const sq = squareMappings.rows.find((s: any) => (s.square_name ?? '').toLowerCase() === name);
      matchedMember = (sq as any)?.shopify_product_id ?? (sq as any)?.family_id;
    }
    const key = matchedMember ?? name ?? 'unknown';
    const existing = productSales.get(key) ?? { units: 0, orders: 0, revenue: 0 };
    existing.units += Number(row.units);
    existing.orders += Number(row.orders);
    existing.revenue += Number(row.revenue);
    productSales.set(key, existing);
  }

  const memberSales = members.rows.map((m: any) => ({
    ...m,
    sales: productSales.get(m.product_id) ?? { units: 0, orders: 0, revenue: 0 },
    squareLinks: squareMappings.rows.filter((s: any) => s.shopify_product_id === m.product_id).length,
  }));

  // Family-only square sales (linked to family but no specific product)
  const familyOnlySquare = squareMappings.rows.filter((s: any) => !s.shopify_product_id && s.family_id === familyId);
  const familyOnlyNames = familyOnlySquare.map((s: any) => (s.square_name ?? '').toLowerCase()).filter(Boolean);
  let familyOnlySales: Array<{ square_name: string; units: number; orders: number; revenue: number }> = [];
  if (familyOnlyNames.length) {
    const foSales = await db.execute(sql`
      SELECT lower(item->>'name') as name, count(*) as units,
        count(DISTINCT o.shopify_order_id) as orders,
        coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
      FROM orders_projection o, jsonb_array_elements(o.line_items) as item
      WHERE lower(item->>'name') IN (${sql.join(familyOnlyNames.map(n => sql`${n}`), sql`, `)})
      GROUP BY 1
    `);
    // Deduplicate by original square name
    const seen = new Set<string>();
    for (const sq of familyOnlySquare as any[]) {
      const key = sq.square_name;
      if (seen.has(key)) continue;
      seen.add(key);
      const match = foSales.rows.find((r: any) => r.name === (sq.square_name ?? '').toLowerCase());
      familyOnlySales.push({
        square_name: sq.square_name,
        units: Number(match?.units ?? 0),
        orders: Number(match?.orders ?? 0),
        revenue: Number(match?.revenue ?? 0),
      });
    }
  }

  return jsonOk({
    familyId,
    members: memberSales,
    familyOnlySquare: familyOnlySales,
    totals: totals.rows[0],
    byChannel: byChannel.rows,
    byLocation: byLocation.rows,
    familyOnlySquareCount: familyOnlySquare.length,
  });
});
