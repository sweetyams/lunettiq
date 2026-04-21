export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';

/**
 * GET /api/crm/products/[id]/intelligence
 * Returns product sales intelligence: by location, by channel, pairs-well-with.
 */
export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:products:read');
  const productId = ctx.params.id;

  // Get all Square catalog IDs mapped to this product
  const mappedIds = await db.execute(sql`
    SELECT square_name FROM product_mappings
    WHERE shopify_product_id = ${productId} AND status IN ('confirmed', 'auto', 'manual')
  `);
  const squareNames = mappedIds.rows.map((r: any) => r.square_name?.toLowerCase()).filter(Boolean);

  // Sales by channel
  const salesByChannel = await db.execute(sql`
    SELECT source, count(*) as orders, coalesce(sum(total_price::numeric), 0) as revenue
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE (
      item->>'product_id' = ${productId}
      OR lower(item->>'name') = ANY(${squareNames.length > 0 ? squareNames : ['__none__']})
    )
    GROUP BY source
  `);

  // Sales by location (in-store)
  const salesByLocation = await db.execute(sql`
    SELECT coalesce(o.location_id, 'online') as location_id, count(*) as orders, coalesce(sum(total_price::numeric), 0) as revenue
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE (
      item->>'product_id' = ${productId}
      OR lower(item->>'name') = ANY(${squareNames.length > 0 ? squareNames : ['__none__']})
    )
    GROUP BY 1
  `);

  // Pairs well with: find products frequently bought by the same customers
  const pairsWellWith = await db.execute(sql`
    SELECT item->>'name' as name, item->>'product_id' as product_id, count(DISTINCT o.shopify_customer_id) as shared_customers
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE o.shopify_customer_id IN (
      SELECT DISTINCT o2.shopify_customer_id
      FROM orders_projection o2, jsonb_array_elements(o2.line_items) as item2
      WHERE (
        item2->>'product_id' = ${productId}
        OR lower(item2->>'name') = ANY(${squareNames.length > 0 ? squareNames : ['__none__']})
      )
      AND o2.shopify_customer_id IS NOT NULL
    )
    AND item->>'product_id' != ${productId}
    AND item->>'name' IS NOT NULL
    AND lower(item->>'name') != ALL(${squareNames.length > 0 ? squareNames : ['__none__']})
    GROUP BY 1, 2
    ORDER BY shared_customers DESC
    LIMIT 10
  `);

  // Total units sold
  const totalSold = await db.execute(sql`
    SELECT count(*) as units
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE (
      item->>'product_id' = ${productId}
      OR lower(item->>'name') = ANY(${squareNames.length > 0 ? squareNames : ['__none__']})
    )
  `);

  return jsonOk({
    totalUnitsSold: Number(totalSold.rows[0]?.units ?? 0),
    salesByChannel: salesByChannel.rows,
    salesByLocation: salesByLocation.rows,
    pairsWellWith: pairsWellWith.rows,
  });
});
