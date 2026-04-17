export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { customersProjection, interactions, appointments, secondSightIntakes, creditsLedger, duplicateCandidates, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { updateCustomerTags } from '@/lib/crm/shopify-admin';
import { eq, or, and, sql } from 'drizzle-orm';

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:clients:merge');
  const { primaryId, secondaryId } = await request.json();

  if (!primaryId || !secondaryId) return jsonError('primaryId and secondaryId required', 400);

  // Re-link CRM data from secondary → primary
  await db.update(interactions).set({ shopifyCustomerId: primaryId }).where(eq(interactions.shopifyCustomerId, secondaryId));
  await db.update(appointments).set({ shopifyCustomerId: primaryId }).where(eq(appointments.shopifyCustomerId, secondaryId));
  await db.update(secondSightIntakes).set({ shopifyCustomerId: primaryId }).where(eq(secondSightIntakes.shopifyCustomerId, secondaryId));
  await db.update(creditsLedger).set({ shopifyCustomerId: primaryId }).where(eq(creditsLedger.shopifyCustomerId, secondaryId));

  // Merge tags
  const [primary, secondary] = await Promise.all([
    db.select({ tags: customersProjection.tags }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, primaryId)).then(r => r[0]),
    db.select({ tags: customersProjection.tags }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, secondaryId)).then(r => r[0]),
  ]);
  const mergedTags = Array.from(new Set([...(primary?.tags ?? []), ...(secondary?.tags ?? [])])).filter(t => !t.startsWith('merged-into-'));
  // Sync to Shopify first, then update projection
  await updateCustomerTags(primaryId, mergedTags);
  await db.update(customersProjection).set({ tags: mergedTags, syncedAt: new Date() }).where(eq(customersProjection.shopifyCustomerId, primaryId));

  // Archive secondary
  const archiveTags = [...(secondary?.tags ?? []), `merged-into-${primaryId}`];
  await updateCustomerTags(secondaryId, archiveTags);
  await db.update(customersProjection).set({ tags: archiveTags, syncedAt: new Date() }).where(eq(customersProjection.shopifyCustomerId, secondaryId));

  // Update duplicate_candidates
  await db.update(duplicateCandidates)
    .set({ status: 'merged' })
    .where(or(
      and(eq(duplicateCandidates.clientA, primaryId), eq(duplicateCandidates.clientB, secondaryId)),
      and(eq(duplicateCandidates.clientA, secondaryId), eq(duplicateCandidates.clientB, primaryId)),
    ));

  await db.insert(auditLog).values({
    action: 'update', entityType: 'client_merge', entityId: primaryId,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: { primaryId, secondaryId, tagsAdded: mergedTags },
  });

  return jsonOk({ primaryId, secondaryId, merged: true });
});
