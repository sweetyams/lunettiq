export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productInteractions, productFeedback } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

const VALID_TYPES = ['viewed', 'recommended', 'tried_on', 'liked', 'disliked', 'shared', 'saved'] as const;
const SENTIMENT_MAP: Record<string, 'like' | 'dislike'> = { liked: 'like', disliked: 'dislike', saved: 'like' };

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:recs:create');
  const body = await request.json();
  const { customerId, productId, variantId, type, sessionId, metadata } = body;

  if (!VALID_TYPES.includes(type)) return jsonError(`Invalid type: ${type}`, 400);

  const [row] = await db.insert(productInteractions).values({
    shopifyCustomerId: customerId,
    shopifyProductId: productId,
    shopifyVariantId: variantId ?? null,
    interactionType: type,
    source: 'crm_web',
    staffId: session.userId,
    locationId: session.locationIds[0],
    sessionId: sessionId ?? null,
    metadata: metadata ?? null,
  }).returning();

  const sentiment = SENTIMENT_MAP[type];
  if (sentiment) {
    await db.insert(productFeedback).values({
      shopifyCustomerId: customerId,
      shopifyProductId: productId,
      sentiment,
      lastInteractionAt: new Date(),
    }).onConflictDoUpdate({
      target: [productFeedback.shopifyCustomerId, productFeedback.shopifyProductId],
      set: { sentiment, lastInteractionAt: new Date(), updatedAt: new Date() },
    });
  }

  return jsonOk(row, 201);
});
