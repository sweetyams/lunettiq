import { db } from '@/lib/db';
import { segments, ordersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { getSegmentMembers } from '@/lib/crm/segment-rules';
import { eq, sql } from 'drizzle-orm';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:segments:read');
  const segment = await db.select().from(segments).where(eq(segments.id, ctx.params.id)).then(r => r[0]);
  if (!segment) return jsonError('Segment not found', 404);

  const members = await getSegmentMembers(segment.rules as any);

  // Vitals
  const ltvs = members.map(m => Number((m as any).totalSpent ?? 0));
  const totalLtv = ltvs.reduce((a, b) => a + b, 0);
  const avgLtv = members.length ? Math.round(totalLtv / members.length) : 0;

  // 90d spend
  const memberIds = members.map((m: any) => m.shopifyCustomerId);
  let spend90d = 0, orders90d = 0;
  if (memberIds.length) {
    const d90 = new Date(Date.now() - 90 * 86400000).toISOString();
    const rows = await db.select({ total: sql<string>`COALESCE(SUM(total_price::numeric), 0)`, cnt: sql<number>`COUNT(*)` })
      .from(ordersProjection)
      .where(sql`${ordersProjection.shopifyCustomerId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)}) AND ${ordersProjection.createdAt} >= ${d90}`);
    spend90d = Math.round(Number(rows[0]?.total ?? 0));
    orders90d = Number(rows[0]?.cnt ?? 0);
  }

  // Median days idle
  const now = Date.now();
  const idleDays = members.map((m: any) => {
    const last = (m as any).lastOrderDate ?? (m as any).syncedAt;
    return last ? Math.round((now - new Date(last).getTime()) / 86400000) : 999;
  }).sort((a, b) => a - b);
  const medianIdle = idleDays.length ? idleDays[Math.floor(idleDays.length / 2)] : 0;

  // Composition: tier
  const tierCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};
  const ltvBands = { '$0–250': 0, '$250–500': 0, '$500–1k': 0, '$1k+': 0 };
  let smsConsent = 0, emailConsent = 0;

  for (const m of members as any[]) {
    const tags: string[] = m.tags ?? [];
    const tier = tags.find((t: string) => t.startsWith('member-'))?.replace('member-', '') ?? 'non-member';
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;

    const loc = m.metafields?.custom?.home_location ?? (m.defaultAddress as any)?.city ?? 'Unknown';
    locationCounts[loc] = (locationCounts[loc] ?? 0) + 1;

    const ltv = Number(m.totalSpent ?? 0);
    if (ltv >= 1000) ltvBands['$1k+']++;
    else if (ltv >= 500) ltvBands['$500–1k']++;
    else if (ltv >= 250) ltvBands['$250–500']++;
    else ltvBands['$0–250']++;

    if (m.smsConsent) smsConsent++;
    if (m.acceptsMarketing) emailConsent++;
  }

  const toSorted = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));

  return jsonOk({
    vitals: { totalLtv: Math.round(totalLtv), avgLtv, spend90d, orders90d, medianIdle, memberCount: members.length },
    composition: {
      tier: toSorted(tierCounts),
      location: toSorted(locationCounts),
      ltvBand: Object.entries(ltvBands).map(([label, count]) => ({ label, count })),
      engagement: { smsConsent, emailConsent, total: members.length },
    },
  });
});
