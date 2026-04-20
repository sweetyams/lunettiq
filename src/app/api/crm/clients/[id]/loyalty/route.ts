export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { creditsLedger, creditCodes, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc, and } from 'drizzle-orm';
import { getTierFromTags } from '@/lib/crm/loyalty-config';
import { getPointsBalance } from '@/lib/crm/points';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:membership:read');
  const customerId = ctx.params.id;

  const [client, creditBalance, pointsBalance, codes, recentLedger] = await Promise.all([
    db.select({ tags: customersProjection.tags, metafields: customersProjection.metafields })
      .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]),
    db.select({ balance: creditsLedger.runningBalance })
      .from(creditsLedger)
      .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'credit')))
      .orderBy(desc(creditsLedger.createdAt)).limit(1).then(r => Number(r[0]?.balance ?? 0)),
    getPointsBalance(customerId),
    db.select().from(creditCodes)
      .where(eq(creditCodes.shopifyCustomerId, customerId))
      .orderBy(desc(creditCodes.createdAt)).limit(20),
    db.select().from(creditsLedger)
      .where(eq(creditsLedger.shopifyCustomerId, customerId))
      .orderBy(desc(creditsLedger.createdAt)).limit(30),
  ]);

  if (!client) return jsonError('Client not found', 404);

  const tier = getTierFromTags(client.tags);
  const meta = ((client.metafields as any)?.custom ?? {}) as Record<string, string>;

  return jsonOk({
    tier,
    status: meta.membership_status ?? (tier ? 'active' : null),
    memberSince: meta.member_since ?? null,
    creditBalance,
    pointsBalance,
    codes: codes.map(c => ({
      id: c.id, method: c.method, code: c.code, fullCode: c.fullCode,
      amount: c.amount, status: c.status, createdAt: c.createdAt,
      revokedAt: c.revokedAt, revokedBy: c.revokedBy,
    })),
    ledger: recentLedger.map(l => ({
      id: l.id, type: l.transactionType, amount: l.amount,
      balance: l.runningBalance, reason: l.reason,
      currency: l.currency, date: l.occurredAt ?? l.createdAt,
    })),
  });
});
