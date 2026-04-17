import { db } from '@/lib/db';
import { customersProjection, ordersProjection, interactions, segments, aiRequests } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql, gte, count } from 'drizzle-orm';

export const GET = handler(async (_req, ctx) => {
  await requireCrmAuth('org:reports:read');
  const { type } = ctx.params;

  switch (type) {
    case 'ltv-cohorts': {
      const rows = await db.select({
        bucket: sql<string>`case
          when ${customersProjection.totalSpent}::numeric < 100 then '$0–100'
          when ${customersProjection.totalSpent}::numeric < 500 then '$100–500'
          when ${customersProjection.totalSpent}::numeric < 1000 then '$500–1000'
          else '$1000+'
        end`,
        customers: sql<number>`count(*)`,
        total_spent: sql<string>`coalesce(sum(${customersProjection.totalSpent}::numeric), 0)::text`,
      }).from(customersProjection).groupBy(sql`1`).orderBy(sql`min(${customersProjection.totalSpent}::numeric)`);
      return jsonOk(rows);
    }

    case 'return-rate': {
      const rows = await db.select({
        order_id: ordersProjection.shopifyOrderId,
        order_number: ordersProjection.orderNumber,
        financial_status: ordersProjection.financialStatus,
        total_price: ordersProjection.totalPrice,
      }).from(ordersProjection)
        .where(sql`${ordersProjection.financialStatus} in ('refunded', 'partially_refunded')`)
        .orderBy(sql`${ordersProjection.totalPrice}::numeric desc`)
        .limit(20);
      return jsonOk(rows);
    }

    case 'staff-activity': {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const rows = await db.select({
        staff_id: interactions.staffId,
        interactions_logged: count(),
        recommendations: sql<number>`count(*) filter (where ${interactions.type} = 'product_recommendation')`,
      }).from(interactions)
        .where(gte(interactions.occurredAt, since))
        .groupBy(interactions.staffId);
      return jsonOk(rows);
    }

    case 'segment-sizes': {
      const rows = await db.select({
        name: segments.name,
        member_count: segments.memberCount,
        updated_at: segments.updatedAt,
      }).from(segments).orderBy(sql`${segments.memberCount} desc nulls last`);
      return jsonOk(rows);
    }

    case 'consent-rates': {
      const [row] = await db.select({
        total: sql<number>`count(*)`,
        email_opted_in: sql<number>`count(*) filter (where ${customersProjection.acceptsMarketing} = true)`,
        sms_opted_in: sql<number>`count(*) filter (where ${customersProjection.smsConsent} = true)`,
      }).from(customersProjection);
      const total = Number(row?.total ?? 0);
      return jsonOk([{
        total_customers: total,
        email_opted_in: Number(row?.email_opted_in ?? 0),
        email_rate: total ? `${((Number(row?.email_opted_in ?? 0) / total) * 100).toFixed(1)}%` : '0%',
        sms_opted_in: Number(row?.sms_opted_in ?? 0),
        sms_rate: total ? `${((Number(row?.sms_opted_in ?? 0) / total) * 100).toFixed(1)}%` : '0%',
      }]);
    }

    case 'ai-usage': {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const rows = await db.select({
        model: aiRequests.model,
        requests: count(),
        total_input_tokens: sql<number>`coalesce(sum(${aiRequests.inputTokens}), 0)`,
        total_output_tokens: sql<number>`coalesce(sum(${aiRequests.outputTokens}), 0)`,
        cost_cents: sql<number>`coalesce(sum(${aiRequests.costEstimateCents}), 0)`,
      }).from(aiRequests)
        .where(gte(aiRequests.requestedAt, since))
        .groupBy(aiRequests.model);
      return jsonOk(rows);
    }

    default:
      return jsonError('Unknown report type', 400);
  }
});
