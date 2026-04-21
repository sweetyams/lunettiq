export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { ordersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';
import { getTimezone } from '@/lib/crm/store-settings';

export const GET = handler(async (request) => {
  await requireCrmAuth('org:reports:read');
  const tz = await getTimezone();
  const params = request.nextUrl.searchParams;
  const days = Number(params.get('days') ?? 30);
  const start = params.get('start');
  const end = params.get('end');
  const locationFilter = params.get('location'); // location_id or empty
  const channelFilter = params.get('channel'); // 'shopify' | 'square' or empty
  const since = start ? new Date(start).toISOString() : new Date(Date.now() - days * 86400000).toISOString();
  const until = end ? new Date(end + 'T23:59:59').toISOString() : new Date().toISOString();

  const locationClause = locationFilter
    ? sql`AND location_id = ${locationFilter}`
    : sql``;
  const channelClause = channelFilter
    ? sql`AND source = ${channelFilter}`
    : sql``;
  const filterClauses = sql`${locationClause} ${channelClause}`;

  // Channel breakdown (always returned for comparison view)
  const channelBreakdown = await db.execute(sql`
    SELECT source, count(*) as orders, coalesce(sum(total_price::numeric), 0) as revenue,
      round(avg(total_price::numeric), 2) as aov
    FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until}
    GROUP BY source ORDER BY revenue DESC
  `);

  // Day-of-week by location (in-store only for comparison)
  const dowByChannel = await db.execute(sql`
    SELECT coalesce(location_id, source) as source,
      extract(dow from (created_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) as dow,
      count(*) as orders, coalesce(sum(total_price::numeric), 0) as revenue
    FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until} AND source = 'square'
    GROUP BY 1, 2 ORDER BY 1, 2
  `);

  // Hourly by location (in-store only)
  const hourlyByChannel = await db.execute(sql`
    SELECT coalesce(location_id, source) as source,
      extract(hour from (created_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) as hour,
      count(*) as orders
    FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until} AND source = 'square'
    GROUP BY 1, 2 ORDER BY 1, 2
  `);

  const [
    revBySource,
    revByDay,
    revByLocation,
    topProducts,
    orderStats,
    hourlyDist,
    repeatCustomers,
    dayOfWeek,
  ] = await Promise.all([
    // Revenue by source
    db.execute(sql`
      SELECT source, count(*) as orders, coalesce(sum(total_price::numeric), 0) as revenue,
        round(avg(total_price::numeric), 2) as aov
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until} ${filterClauses}
      GROUP BY source`),

    // Revenue by day
    db.execute(sql`
      SELECT date_trunc('day', created_at)::date as day, count(*) as orders,
        coalesce(sum(total_price::numeric), 0) as revenue
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until} ${filterClauses}
      GROUP BY 1 ORDER BY 1`),

    // Revenue by location (from tags)
    db.execute(sql`
      SELECT location_id as location, count(*) as orders,
        coalesce(sum(total_price::numeric), 0) as revenue,
        round(avg(total_price::numeric), 2) as aov
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until} AND location_id IS NOT NULL ${filterClauses}
      GROUP BY 1 ORDER BY revenue DESC`),

    // Top products
    db.execute(sql`
      SELECT item->>'name' as name, item->>'product_id' as product_id,
        count(*) as sold, sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)) as revenue
      FROM orders_projection, jsonb_array_elements(line_items) as item
      WHERE created_at >= ${since} AND created_at <= ${until} AND item->>'name' IS NOT NULL ${filterClauses}
      GROUP BY 1, 2 ORDER BY sold DESC LIMIT 20`),

    // General stats
    db.execute(sql`
      SELECT count(*) as total_orders,
        coalesce(sum(total_price::numeric), 0) as total_revenue,
        round(avg(total_price::numeric), 2) as aov,
        count(DISTINCT shopify_customer_id) as unique_customers
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until} ${filterClauses}`),

    // Hourly distribution — convert UTC to app timezone
    db.execute(sql`
      SELECT extract(hour from (created_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) as hour, count(*) as orders
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until} ${filterClauses}
      GROUP BY 1 ORDER BY 1`),

    // Repeat customers
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE cnt = 1) as one_time,
        count(*) FILTER (WHERE cnt = 2) as two_orders,
        count(*) FILTER (WHERE cnt >= 3) as three_plus
      FROM (
        SELECT shopify_customer_id, count(*) as cnt
        FROM orders_projection WHERE shopify_customer_id IS NOT NULL AND created_at >= ${since} AND created_at <= ${until} ${filterClauses}
        GROUP BY 1
      ) sub`),

    // Day of week distribution
    db.execute(sql`
      SELECT extract(dow from (created_at AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) as dow,
        count(*) as orders, coalesce(sum(total_price::numeric), 0) as revenue
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until} ${filterClauses}
      GROUP BY 1 ORDER BY 1`),
  ]);

  // Top families (resolve products to families via product_family_members)
  const topFamilies = await db.execute(sql`
    SELECT f.id, f.name, count(*) as sold,
      coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    JOIN product_family_members m ON m.product_id = item->>'product_id'
    JOIN product_families f ON f.id = m.family_id
    WHERE o.created_at >= ${since} AND o.created_at <= ${until} ${filterClauses}
    GROUP BY f.id, f.name
    ORDER BY sold DESC LIMIT 15
  `).catch(() => ({ rows: [] }));

  // Optical vs Sun split (using product_category metafield)
  const categorySplit = await db.execute(sql`
    SELECT p.metafields->'custom'->>'product_category' as category,
      count(*) as sold,
      coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    JOIN products_projection p ON p.shopify_product_id = item->>'product_id'
    WHERE o.created_at >= ${since} AND o.created_at <= ${until}
    AND p.metafields->'custom'->>'product_category' IS NOT NULL ${filterClauses}
    GROUP BY 1
  `).catch(() => ({ rows: [] }));

  return jsonOk({
    period: { days, since },
    summary: orderStats.rows[0],
    revBySource: revBySource.rows,
    revByDay: revByDay.rows,
    revByLocation: revByLocation.rows,
    topProducts: topProducts.rows,
    topFamilies: topFamilies.rows,
    categorySplit: categorySplit.rows,
    hourlyDistribution: hourlyDist.rows,
    repeatCustomers: repeatCustomers.rows[0],
    dayOfWeek: dayOfWeek.rows,
    channelBreakdown: channelBreakdown.rows,
    dowByChannel: dowByChannel.rows,
    hourlyByChannel: hourlyByChannel.rows,
  });
});
