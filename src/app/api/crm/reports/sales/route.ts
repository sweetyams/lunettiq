export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { ordersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth('org:reports:read');
  const params = request.nextUrl.searchParams;
  const days = Number(params.get('days') ?? 30);
  const start = params.get('start');
  const end = params.get('end');
  const since = start ? new Date(start).toISOString() : new Date(Date.now() - days * 86400000).toISOString();
  const until = end ? new Date(end + 'T23:59:59').toISOString() : new Date().toISOString();

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
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until}
      GROUP BY source`),

    // Revenue by day
    db.execute(sql`
      SELECT date_trunc('day', created_at)::date as day, count(*) as orders,
        coalesce(sum(total_price::numeric), 0) as revenue
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until}
      GROUP BY 1 ORDER BY 1`),

    // Revenue by location (from tags)
    db.execute(sql`
      SELECT tags[1] as location, count(*) as orders,
        coalesce(sum(total_price::numeric), 0) as revenue,
        round(avg(total_price::numeric), 2) as aov
      FROM orders_projection WHERE source = 'square' AND created_at >= ${since} AND created_at <= ${until}
      GROUP BY 1 ORDER BY revenue DESC`),

    // Top products
    db.execute(sql`
      SELECT item->>'name' as name, item->>'product_id' as product_id,
        count(*) as sold, sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)) as revenue
      FROM orders_projection, jsonb_array_elements(line_items) as item
      WHERE created_at >= ${since} AND created_at <= ${until} AND item->>'name' IS NOT NULL
      GROUP BY 1, 2 ORDER BY sold DESC LIMIT 20`),

    // General stats
    db.execute(sql`
      SELECT count(*) as total_orders,
        coalesce(sum(total_price::numeric), 0) as total_revenue,
        round(avg(total_price::numeric), 2) as aov,
        count(DISTINCT shopify_customer_id) as unique_customers
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until}`),

    // Hourly distribution — convert UTC to app timezone
    db.execute(sql`
      SELECT extract(hour from (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Montreal') as hour, count(*) as orders
      FROM orders_projection WHERE source = 'square' AND created_at >= ${since} AND created_at <= ${until}
      GROUP BY 1 ORDER BY 1`),

    // Repeat customers
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE cnt = 1) as one_time,
        count(*) FILTER (WHERE cnt = 2) as two_orders,
        count(*) FILTER (WHERE cnt >= 3) as three_plus
      FROM (
        SELECT shopify_customer_id, count(*) as cnt
        FROM orders_projection WHERE shopify_customer_id IS NOT NULL AND created_at >= ${since} AND created_at <= ${until}
        GROUP BY 1
      ) sub`),

    // Day of week distribution
    db.execute(sql`
      SELECT extract(dow from (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Montreal') as dow,
        count(*) as orders, coalesce(sum(total_price::numeric), 0) as revenue
      FROM orders_projection WHERE created_at >= ${since} AND created_at <= ${until}
      GROUP BY 1 ORDER BY 1`),
  ]);

  return jsonOk({
    period: { days, since },
    summary: orderStats.rows[0],
    revBySource: revBySource.rows,
    revByDay: revByDay.rows,
    revByLocation: revByLocation.rows,
    topProducts: topProducts.rows,
    hourlyDistribution: hourlyDist.rows,
    repeatCustomers: repeatCustomers.rows[0],
    dayOfWeek: dayOfWeek.rows,
  });
});
