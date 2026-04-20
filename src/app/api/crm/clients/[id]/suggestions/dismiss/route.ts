export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productFeedback } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

// POST /api/crm/clients/[id]/suggestions/dismiss
export const POST = handler(async (request, ctx) => {
  await requireCrmAuth();
  const customerId = ctx.params.id;
  const { productId, sentiment } = await request.json();
  if (!productId) return jsonError('productId required', 400);

  const s = sentiment === 'like' ? 'like' : 'dislike';

  await db.insert(productFeedback).values({
    shopifyCustomerId: customerId,
    shopifyProductId: productId,
    sentiment: s,
    lastInteractionAt: new Date(),
  }).onConflictDoUpdate({
    target: [productFeedback.shopifyCustomerId, productFeedback.shopifyProductId],
    set: { sentiment: s, lastInteractionAt: new Date(), updatedAt: new Date() },
  });

  return jsonOk({ dismissed: true });
});
