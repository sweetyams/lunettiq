export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { appointments, customersProjection, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, lt, gte, sql } from 'drizzle-orm';

const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['confirmed', 'cancelled', 'completed'],
  confirmed: ['completed', 'cancelled', 'no_show'],
};

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth();
  const row = await db
    .select({
      appointment: appointments,
      customerFirstName: customersProjection.firstName,
      customerLastName: customersProjection.lastName,
      customerEmail: customersProjection.email,
      customerPhone: customersProjection.phone,
    })
    .from(appointments)
    .leftJoin(customersProjection, eq(appointments.shopifyCustomerId, customersProjection.shopifyCustomerId))
    .where(eq(appointments.id, ctx.params.id))
    .then((r) => r[0]);

  if (!row) return jsonError('Appointment not found', 404);

  return jsonOk({
    ...row.appointment,
    customer: row.customerFirstName || row.customerLastName
      ? { firstName: row.customerFirstName, lastName: row.customerLastName, email: row.customerEmail, phone: row.customerPhone }
      : null,
  });
});

export const PATCH = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:appointments:update');
  const id = ctx.params.id;
  const body = await request.json();

  const existing = await db.select().from(appointments).where(eq(appointments.id, id)).then((r) => r[0]);
  if (!existing) return jsonError('Appointment not found', 404);

  // Status transition validation
  if (body.status && body.status !== existing.status) {
    const allowed = VALID_TRANSITIONS[existing.status!] ?? [];
    if (!allowed.includes(body.status)) {
      return jsonError(`Cannot transition from ${existing.status} to ${body.status}`, 400);
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.staffId !== undefined) updates.staffId = body.staffId;
  if (body.status !== undefined) updates.status = body.status;
  if (body.startsAt !== undefined) updates.startsAt = new Date(body.startsAt);
  if (body.endsAt !== undefined) updates.endsAt = new Date(body.endsAt);

  // Overlap check if time or staff changed
  const newStaff = (updates.staffId as string) ?? existing.staffId;
  const newStart = (updates.startsAt as Date) ?? existing.startsAt;
  const newEnd = (updates.endsAt as Date) ?? existing.endsAt;
  if (updates.startsAt || updates.endsAt || updates.staffId) {
    const overlap = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.staffId, newStaff!),
          lt(appointments.startsAt, newEnd),
          gte(appointments.endsAt, newStart),
          sql`${appointments.id} != ${id}`,
          sql`${appointments.status} NOT IN ('cancelled')`,
        ),
      )
      .limit(1);
    if (overlap.length > 0) return jsonError('Staff has an overlapping appointment', 409);
  }

  const [updated] = await db.update(appointments).set(updates).where(eq(appointments.id, id)).returning();

  await db.insert(auditLog).values({
    action: 'update', entityType: 'appointment', entityId: id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: body,
  });

  return jsonOk(updated);
});

export const DELETE = handler(async (_request, ctx) => {
  const session = await requireCrmAuth('org:appointments:delete');
  const id = ctx.params.id;

  const existing = await db.select().from(appointments).where(eq(appointments.id, id)).then((r) => r[0]);
  if (!existing) return jsonError('Appointment not found', 404);

  const [updated] = await db
    .update(appointments)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(appointments.id, id))
    .returning();

  await db.insert(auditLog).values({
    action: 'delete', entityType: 'appointment', entityId: id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
  });

  return jsonOk(updated);
});
