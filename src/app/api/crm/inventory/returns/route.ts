export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { returnInspections } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, desc } from 'drizzle-orm';
import { adjust, projectToChannels } from '@/lib/crm/inventory';

// GET /api/crm/inventory/returns?status=awaiting
export const GET = handler(async (request) => {
  await requireCrmAuth('org:products:read');
  const status = request.nextUrl.searchParams.get('status');
  const rows = await db.select().from(returnInspections)
    .where(status ? eq(returnInspections.status, status as any) : undefined)
    .orderBy(desc(returnInspections.createdAt))
    .limit(100);
  return jsonOk(rows);
});

// POST /api/crm/inventory/returns — create pending or resolve inspection
export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:products:update');
  const body = await request.json();

  if (body.action === 'create') {
    if (!body.familyId || !body.colour || !body.locationId) {
      return jsonError('familyId, colour, locationId required', 400);
    }
    const [row] = await db.insert(returnInspections).values({
      shopifyRefundId: body.shopifyRefundId ?? null,
      squareRefundId: body.squareRefundId ?? null,
      familyId: body.familyId, colour: body.colour, locationId: body.locationId,
    }).returning();
    return jsonOk(row, 201);
  }

  if (body.action === 'resolve') {
    if (!body.id || !body.status) return jsonError('id and status required', 400);
    if (!['sellable', 'damaged', 'refurbish', 'written_off'].includes(body.status)) {
      return jsonError('status must be sellable, damaged, refurbish, or written_off', 400);
    }
    const [row] = await db.update(returnInspections).set({
      status: body.status, inspectedBy: session.userId, inspectedAt: new Date(), notes: body.notes ?? null, photoUrl: body.photoUrl ?? null,
    }).where(and(eq(returnInspections.id, body.id), eq(returnInspections.status, 'awaiting'))).returning();
    if (!row) return jsonError('Inspection not found or already resolved', 404);

    // If sellable, add back to inventory
    if (body.status === 'sellable') {
      await adjust({
        familyId: row.familyId, colour: row.colour, locationId: row.locationId,
        field: 'on_hand', delta: 1, reason: 'return',
        referenceId: row.shopifyRefundId ?? row.squareRefundId ?? row.id,
        referenceType: row.shopifyRefundId ? 'shopify_refund' : row.squareRefundId ? 'square_refund' : 'return_inspection',
        staffId: session.userId, note: body.notes ?? 'Return inspection: sellable',
      });
      await projectToChannels(row.familyId, row.colour, null);
    } else if (body.status === 'damaged' || body.status === 'written_off') {
      await adjust({
        familyId: row.familyId, colour: row.colour, locationId: row.locationId,
        field: 'on_hand', delta: 0, reason: 'damage',
        referenceId: row.id, referenceType: 'return_inspection',
        staffId: session.userId, note: `Return inspection: ${body.status}`,
      });
    }
    return jsonOk(row);
  }

  return jsonError('action must be create or resolve', 400);
});
