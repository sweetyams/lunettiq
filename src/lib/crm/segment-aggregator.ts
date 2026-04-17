import { db } from '@/lib/db';
import { customersProjection, ordersProjection } from '@/lib/db/schema';
import { sql, gte, lt, and } from 'drizzle-orm';

export interface AggregatedStats {
  totalCustomers: number;
  ltvBuckets: Record<string, number>;
  orderFrequency: Record<string, number>;
  topTags: { tag: string; count: number }[];
  dormancyBuckets: Record<string, number>;
  tierBreakdown: Record<string, number>;
  consentRates: { email: number; sms: number };
  avgOrderValue: number;
}

export async function aggregateCustomerData(dateRange?: { from: string; to: string }): Promise<AggregatedStats> {
  const dateFilter = dateRange
    ? and(gte(ordersProjection.createdAt, new Date(dateRange.from)), lt(ordersProjection.createdAt, new Date(dateRange.to)))
    : undefined;

  const [totalResult, ltvRows, tagRows, consentResult, orderStats] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customersProjection),

    db.select({
      id: customersProjection.shopifyCustomerId,
      spent: customersProjection.totalSpent,
      orderCount: customersProjection.orderCount,
      tags: customersProjection.tags,
      acceptsMarketing: customersProjection.acceptsMarketing,
      smsConsent: customersProjection.smsConsent,
      lastOrder: sql<string>`(SELECT max(created_at) FROM orders_projection WHERE shopify_customer_id = ${customersProjection.shopifyCustomerId})`,
    }).from(customersProjection),

    db.select({
      tag: sql<string>`unnest(${customersProjection.tags})`,
      count: sql<number>`count(*)`,
    }).from(customersProjection).groupBy(sql`unnest(${customersProjection.tags})`).orderBy(sql`count(*) desc`).limit(30),

    db.select({
      emailCount: sql<number>`count(*) filter (where ${customersProjection.acceptsMarketing} = true)`,
      smsCount: sql<number>`count(*) filter (where ${customersProjection.smsConsent} = true)`,
      total: sql<number>`count(*)`,
    }).from(customersProjection),

    dateFilter
      ? db.select({ avg: sql<string>`coalesce(avg(${ordersProjection.totalPrice}::numeric), 0)` }).from(ordersProjection).where(dateFilter)
      : db.select({ avg: sql<string>`coalesce(avg(${ordersProjection.totalPrice}::numeric), 0)` }).from(ordersProjection),
  ]);

  const total = Number(totalResult[0]?.count ?? 0);
  const now = Date.now();

  // Build buckets from customer rows
  const ltvBuckets: Record<string, number> = { '$0': 0, '$1-100': 0, '$100-500': 0, '$500-1000': 0, '$1000+': 0 };
  const orderFrequency: Record<string, number> = { '0': 0, '1': 0, '2-5': 0, '6-10': 0, '10+': 0 };
  const dormancyBuckets: Record<string, number> = { 'active_30d': 0, '30-90d': 0, '90-180d': 0, '180-365d': 0, '365d+': 0, 'never': 0 };
  const tierBreakdown: Record<string, number> = { 'non-member': 0, essential: 0, cult: 0, vault: 0 };

  for (const r of ltvRows) {
    const ltv = Number(r.spent ?? 0);
    if (ltv === 0) ltvBuckets['$0']++;
    else if (ltv <= 100) ltvBuckets['$1-100']++;
    else if (ltv <= 500) ltvBuckets['$100-500']++;
    else if (ltv <= 1000) ltvBuckets['$500-1000']++;
    else ltvBuckets['$1000+']++;

    const oc = r.orderCount ?? 0;
    if (oc === 0) orderFrequency['0']++;
    else if (oc === 1) orderFrequency['1']++;
    else if (oc <= 5) orderFrequency['2-5']++;
    else if (oc <= 10) orderFrequency['6-10']++;
    else orderFrequency['10+']++;

    const lastOrder = r.lastOrder ? new Date(r.lastOrder).getTime() : 0;
    const daysSince = lastOrder ? Math.floor((now - lastOrder) / 86400000) : Infinity;
    if (daysSince === Infinity) dormancyBuckets['never']++;
    else if (daysSince <= 30) dormancyBuckets['active_30d']++;
    else if (daysSince <= 90) dormancyBuckets['30-90d']++;
    else if (daysSince <= 180) dormancyBuckets['90-180d']++;
    else if (daysSince <= 365) dormancyBuckets['180-365d']++;
    else dormancyBuckets['365d+']++;

    const tags = r.tags ?? [];
    if (tags.includes('member-vault')) tierBreakdown.vault++;
    else if (tags.includes('member-cult')) tierBreakdown.cult++;
    else if (tags.includes('member-essential')) tierBreakdown.essential++;
    else tierBreakdown['non-member']++;
  }

  const consent = consentResult[0];
  const consentTotal = Number(consent?.total ?? 1);

  return {
    totalCustomers: total,
    ltvBuckets,
    orderFrequency,
    topTags: tagRows.map(r => ({ tag: r.tag, count: Number(r.count) })),
    dormancyBuckets,
    tierBreakdown,
    consentRates: {
      email: Math.round((Number(consent?.emailCount ?? 0) / consentTotal) * 100),
      sms: Math.round((Number(consent?.smsCount ?? 0) / consentTotal) * 100),
    },
    avgOrderValue: Number(Number(orderStats[0]?.avg ?? 0).toFixed(2)),
  };
}
