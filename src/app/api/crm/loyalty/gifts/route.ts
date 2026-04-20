export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { giftFulfilments, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth('org:membership:read');
  const rows = await db.select({
    gift: giftFulfilments,
    firstName: customersProjection.firstName,
    lastName: customersProjection.lastName,
  }).from(giftFulfilments)
    .leftJoin(customersProjection, eq(giftFulfilments.shopifyCustomerId, customersProjection.shopifyCustomerId))
    .orderBy(desc(giftFulfilments.createdAt));
  return jsonOk(rows.map(r => ({ ...r.gift, customerName: [r.firstName, r.lastName].filter(Boolean).join(' ') })));
});

export const PATCH = handler(async (req) => {
  await requireCrmAuth('org:membership:update_status');
  const { id, status, giftDescription, trackingNumber } = await req.json();
  if (!id) return jsonError('id required', 400);
  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (giftDescription !== undefined) updates.giftDescription = giftDescription;
  if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
  if (status === 'shipped') updates.shippedAt = new Date();
  const [row] = await db.update(giftFulfilments).set(updates).where(eq(giftFulfilments.id, id)).returning();
  return jsonOk(row);
});
