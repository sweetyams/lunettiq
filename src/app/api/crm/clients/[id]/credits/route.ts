export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { creditsLedger, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc, sql } from 'drizzle-orm';
import { updateCustomerMetafield } from '@/lib/crm/shopify-admin';

export const GET = handler(async (request, ctx) => {
  await requireCrmAuth('org:credits:read');
  const id = ctx.params.id;
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 50), 100);
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0);

  const rows = await db.select().from(creditsLedger)
    .where(eq(creditsLedger.shopifyCustomerId, id))
    .orderBy(desc(creditsLedger.occurredAt))
    .limit(limit).offset(offset);

  return jsonOk(rows);
});

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:credits:adjust');
  const id = ctx.params.id;
  const { amount, reason } = await request.json();

  if (!amount || !reason) return jsonError('amount and reason required', 400);

  // Get current balance
  const balanceResult = await db
    .select({ total: sql<string>`coalesce(sum(${creditsLedger.amount}), 0)` })
    .from(creditsLedger)
    .where(eq(creditsLedger.shopifyCustomerId, id));
  const currentBalance = Number(balanceResult[0]?.total ?? 0);
  const newBalance = currentBalance + Number(amount);

  const [row] = await db.insert(creditsLedger).values({
    shopifyCustomerId: id,
    transactionType: 'adjustment',
    amount: String(amount),
    runningBalance: String(newBalance),
    reason,
    staffId: session.userId,
    locationId: session.locationIds[0],
  }).returning();

  // Update Shopify metafield
  await updateCustomerMetafield(Number(id), 'custom', 'credits_balance', String(newBalance), 'number_decimal').catch(() => {});

  await db.insert(auditLog).values({
    action: 'credit_adjustment', entityType: 'credits_ledger', entityId: row.id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: { amount, reason, newBalance },
  });

  return jsonOk(row, 201);
});
