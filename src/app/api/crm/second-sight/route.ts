export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { secondSightIntakes, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:second_sight:create');
  const body = await request.json();

  const [row] = await db.insert(secondSightIntakes).values({
    shopifyCustomerId: body.customerId,
    status: 'draft',
    notes: body.notes,
    currentFrames: body.currentFrames ? { description: body.currentFrames } : null,
    staffId: session.userId,
    locationId: session.locationIds[0],
  }).returning();

  await db.insert(auditLog).values({
    action: 'create', entityType: 'second_sight_intake', entityId: row.id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
  });

  return jsonOk(row, 201);
});
