export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { creditsLedger, creditCodes, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc, and } from 'drizzle-orm';

// POST: revoke a credit code, return balance to customer
export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:credits:adjust');
  const customerId = ctx.params.id;
  const { codeId, reason } = await request.json();

  if (!codeId) return jsonError('codeId required', 400);

  // Find the code
  const code = await db.select().from(creditCodes)
    .where(and(eq(creditCodes.id, codeId), eq(creditCodes.shopifyCustomerId, customerId)))
    .then(r => r[0]);

  if (!code) return jsonError('Code not found', 404);
  if (code.status !== 'active') return jsonError(`Code already ${code.status}`, 400);

  const revokeAmount = Number(code.amount);

  // Disable Shopify gift card if applicable
  if (code.method === 'gift_card' && code.shopifyGiftCardId) {
    const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
    const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
    await fetch(`https://${SHOP}/admin/api/2024-01/gift_cards/${code.shopifyGiftCardId}/disable.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN! },
    }).catch(() => {});
  }

  // Mark code as revoked
  await db.update(creditCodes).set({ status: 'revoked', revokedAt: new Date(), revokedBy: session.userId })
    .where(eq(creditCodes.id, codeId));

  // Return balance
  const lastEntry = await db.select({ balance: creditsLedger.runningBalance })
    .from(creditsLedger)
    .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'credit')))
    .orderBy(desc(creditsLedger.createdAt)).limit(1).then(r => r[0]);
  const currentBalance = Number(lastEntry?.balance ?? 0);

  await db.insert(creditsLedger).values({
    shopifyCustomerId: customerId,
    currency: 'credit',
    transactionType: 'adjustment',
    amount: String(revokeAmount),
    runningBalance: String(currentBalance + revokeAmount),
    reason: reason || `Revoked ${code.method} code: ${code.code}`,
    staffId: session.userId,
  });

  // Audit
  await db.insert(auditLog).values({
    action: 'update', entityType: 'credit_code', entityId: codeId,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: { action: 'revoke', code: code.code, amount: revokeAmount, reason },
  });

  return jsonOk({ revoked: true, code: code.code, amount: revokeAmount, newBalance: currentBalance + revokeAmount });
});
