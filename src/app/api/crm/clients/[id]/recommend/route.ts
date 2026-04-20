export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { interactions, productInteractions, productFeedback, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:products:recommend');
  const id = ctx.params.id;
  const { productId, productTitle } = await request.json();

  if (!productId) return jsonError('productId required', 400);

  const [row] = await db.insert(interactions).values({
    shopifyCustomerId: id,
    type: 'product_recommendation',
    direction: 'outbound',
    subject: `Recommended: ${productTitle || productId}`,
    metadata: { productId, productTitle },
    staffId: session.userId,
    locationId: session.locationIds[0],
  }).returning();

  // Also record as product interaction so it shows in suggestions
  await db.insert(productInteractions).values({
    shopifyCustomerId: id,
    shopifyProductId: productId,
    interactionType: 'recommended',
    source: 'crm_web',
    staffId: session.userId,
    locationId: session.locationIds[0],
  });

  // Upsert feedback so suggestions API picks it up
  await db.insert(productFeedback).values({
    shopifyCustomerId: id,
    shopifyProductId: productId,
    sentiment: 'like',
    lastInteractionAt: new Date(),
  }).onConflictDoUpdate({
    target: [productFeedback.shopifyCustomerId, productFeedback.shopifyProductId],
    set: { sentiment: 'like', lastInteractionAt: new Date(), updatedAt: new Date() },
  });

  await db.insert(auditLog).values({
    action: 'create', entityType: 'interaction', entityId: row.id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
  });

  return jsonOk(row, 201);
});
