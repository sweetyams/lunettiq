import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';
import { addCustomerTag, removeCustomerTag } from '@/lib/crm/shopify-admin';

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:tags:apply');
  const id = ctx.params.id;
  const { tag, action } = await request.json();

  if (!tag || !action) return jsonError('tag and action (add|remove) required', 400);

  const result = action === 'remove'
    ? await removeCustomerTag(Number(id), tag)
    : await addCustomerTag(Number(id), tag);

  if (!result.ok) return jsonError(result.error, 502);

  // Update projection
  const client = await db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]);
  if (client) {
    const currentTags = client.tags ?? [];
    const newTags = action === 'remove'
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    await db.update(customersProjection).set({ tags: newTags, syncedAt: new Date() }).where(eq(customersProjection.shopifyCustomerId, id));
  }

  await db.insert(auditLog).values({
    action: 'tag_change', entityType: 'customer', entityId: id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: { tag, action },
  });

  return jsonOk({ tags: action === 'remove' ? (client?.tags ?? []).filter(t => t !== tag) : [...(client?.tags ?? []), tag] });
});
