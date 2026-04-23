export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { inventoryTransfers, inventoryTransferLines } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc } from 'drizzle-orm';
import { adjust, projectToChannels } from '@/lib/crm/inventory';

export const GET = handler(async () => {
  await requireCrmAuth('org:products:read');
  const transfers = await db.select().from(inventoryTransfers).orderBy(desc(inventoryTransfers.createdAt)).limit(50);
  const lines = await db.select().from(inventoryTransferLines);
  return jsonOk({ transfers, lines });
});

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:products:update');
  const body = await request.json();
  const { action } = body;

  // Create transfer
  if (action === 'create') {
    const { fromLocationId, toLocationId, items, note } = body;
    if (!fromLocationId || !toLocationId || !items?.length) return jsonError('fromLocationId, toLocationId, items required', 400);
    const [transfer] = await db.insert(inventoryTransfers).values({
      fromLocationId, toLocationId, status: 'requested', requestedBy: session.userId, note,
    }).returning();
    for (const item of items) {
      await db.insert(inventoryTransferLines).values({
        transferId: transfer.id, familyId: item.familyId, colour: item.colour, variantId: item.variantId, quantity: item.quantity,
      });
    }
    return jsonOk(transfer, 201);
  }

  // Approve
  if (action === 'approve') {
    const [t] = await db.update(inventoryTransfers).set({ status: 'approved', approvedBy: session.userId, updatedAt: new Date() }).where(eq(inventoryTransfers.id, body.id)).returning();
    return jsonOk(t);
  }

  // Ship — decrement origin
  if (action === 'ship') {
    const [t] = await db.update(inventoryTransfers).set({ status: 'shipped', updatedAt: new Date() }).where(eq(inventoryTransfers.id, body.id)).returning();
    const lines = await db.select().from(inventoryTransferLines).where(eq(inventoryTransferLines.transferId, body.id));
    for (const line of lines) {
      await adjust({ familyId: line.familyId, colour: line.colour, variantId: line.variantId, locationId: t.fromLocationId, field: 'on_hand', delta: -line.quantity, reason: 'transfer', referenceId: t.id, referenceType: 'transfer', staffId: session.userId });
      await projectToChannels(line.familyId, line.colour, line.variantId);
    }
    return jsonOk(t);
  }

  // Receive — increment destination
  if (action === 'receive') {
    const [t] = await db.update(inventoryTransfers).set({ status: 'received', updatedAt: new Date() }).where(eq(inventoryTransfers.id, body.id)).returning();
    const lines = await db.select().from(inventoryTransferLines).where(eq(inventoryTransferLines.transferId, body.id));
    for (const line of lines) {
      const receivedQty = body.receivedQuantities?.[line.id] ?? line.quantity;
      await db.update(inventoryTransferLines).set({ receivedQuantity: receivedQty }).where(eq(inventoryTransferLines.id, line.id));
      await adjust({ familyId: line.familyId, colour: line.colour, variantId: line.variantId, locationId: t.toLocationId, field: 'on_hand', delta: receivedQty, reason: 'transfer', referenceId: t.id, referenceType: 'transfer', staffId: session.userId });
      if (receivedQty < line.quantity) {
        await adjust({ familyId: line.familyId, colour: line.colour, variantId: line.variantId, locationId: t.fromLocationId, field: 'on_hand', delta: line.quantity - receivedQty, reason: 'loss', referenceId: t.id, referenceType: 'transfer', staffId: session.userId, note: `Transfer discrepancy: sent ${line.quantity}, received ${receivedQty}` });
      }
      await projectToChannels(line.familyId, line.colour, line.variantId);
    }
    return jsonOk(t);
  }

  // Cancel
  if (action === 'cancel') {
    const [t] = await db.update(inventoryTransfers).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(inventoryTransfers.id, body.id)).returning();
    return jsonOk(t);
  }

  return jsonError('action must be create, approve, ship, receive, or cancel', 400);
});
