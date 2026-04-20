export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { creditsLedger } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, desc } from 'drizzle-orm';
import { getPointsBalance, issuePoints } from '@/lib/crm/points';

export const GET = handler(async (_req, ctx) => {
  await requireCrmAuth('org:credits:read');
  const id = ctx.params.id;
  const [balance, history] = await Promise.all([
    getPointsBalance(id),
    db.select().from(creditsLedger)
      .where(and(eq(creditsLedger.shopifyCustomerId, id), eq(creditsLedger.currency, 'points')))
      .orderBy(desc(creditsLedger.occurredAt)).limit(20),
  ]);
  return jsonOk({ balance, history });
});

export const POST = handler(async (req, ctx) => {
  const session = await requireCrmAuth('org:credits:adjust');
  const id = ctx.params.id;
  const { amount, reason } = await req.json();
  if (!amount || !reason) return jsonError('amount and reason required', 400);
  await issuePoints({ customerId: id, amount: Number(amount), type: amount > 0 ? 'points_issued_milestone' : 'points_expired', reason: `Manual: ${reason}` });
  const balance = await getPointsBalance(id);
  return jsonOk({ balance });
});
