export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { appointments, customersProjection, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonList, jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, gte, lt, sql, SQL } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth();
  const params = request.nextUrl.searchParams;

  const weekParam = params.get('week');
  const weekStart = weekParam ? new Date(weekParam) : getMonday(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const conditions: SQL[] = [
    gte(appointments.startsAt, weekStart),
    lt(appointments.startsAt, weekEnd),
  ];

  const staffId = params.get('staffId');
  if (staffId) conditions.push(eq(appointments.staffId, staffId));
  const locationId = params.get('locationId');
  if (locationId) conditions.push(eq(appointments.locationId, locationId));
  const status = params.get('status');
  if (status) conditions.push(eq(appointments.status, status as any));

  const rows = await db
    .select({
      appointment: appointments,
      customerFirstName: customersProjection.firstName,
      customerLastName: customersProjection.lastName,
    })
    .from(appointments)
    .leftJoin(customersProjection, eq(appointments.shopifyCustomerId, customersProjection.shopifyCustomerId))
    .where(and(...conditions))
    .orderBy(appointments.startsAt);

  const data = rows.map((r) => ({
    ...r.appointment,
    customerName: r.customerFirstName || r.customerLastName
      ? `${r.customerFirstName ?? ''} ${r.customerLastName ?? ''}`.trim()
      : null,
  }));

  return jsonList(data, { total: data.length, limit: data.length, offset: 0 });
});

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:appointments:create');
  const body = await request.json();

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  const staffId = body.staffId || session.userId;
  const locationId = body.locationId || session.locationIds[0];

  // Check overlap for same staff
  const overlap = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.staffId, staffId),
        lt(appointments.startsAt, endsAt),
        gte(appointments.endsAt, startsAt),
        sql`${appointments.status} NOT IN ('cancelled')`,
      ),
    )
    .limit(1);

  if (overlap.length > 0) return jsonError('Staff has an overlapping appointment', 409);

  const [row] = await db.insert(appointments).values({
    shopifyCustomerId: body.customerId || null,
    title: body.title,
    startsAt,
    endsAt,
    notes: body.notes,
    staffId,
    locationId,
  }).returning();

  await db.insert(auditLog).values({
    action: 'create', entityType: 'appointment', entityId: row.id,
    staffId: session.userId, surface: 'web', locationId,
  });

  return jsonOk(row, 201);
});

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}
