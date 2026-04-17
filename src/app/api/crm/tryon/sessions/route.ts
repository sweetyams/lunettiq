import { db } from '@/lib/db';
import { tryOnSessions } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:tryon:initiate');
  const { customerId } = await request.json();

  const [created] = await db.insert(tryOnSessions).values({
    shopifyCustomerId: customerId,
    staffId: session.userId,
    locationId: session.primaryLocationId,
  }).returning();

  return jsonOk(created);
});
