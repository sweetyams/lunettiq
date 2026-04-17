export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { appointments } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, gte, lt, sql } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth();
  const params = request.nextUrl.searchParams;

  const dateStr = params.get('date');
  const staffId = params.get('staffId');
  if (!dateStr || !staffId) return jsonError('date and staffId are required', 400);

  const duration = Number(params.get('duration') ?? 30);
  const dayStart = new Date(dateStr);
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date(dateStr);
  dayEnd.setHours(18, 0, 0, 0);

  const conditions = [
    eq(appointments.staffId, staffId),
    lt(appointments.startsAt, dayEnd),
    gte(appointments.endsAt, dayStart),
    sql`${appointments.status} NOT IN ('cancelled')`,
  ];
  const locationId = params.get('locationId');
  if (locationId) conditions.push(eq(appointments.locationId, locationId));

  const booked = await db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(and(...conditions));

  const slots: { start: string; end: string }[] = [];
  const cursor = new Date(dayStart);

  while (cursor.getTime() + duration * 60000 <= dayEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + duration * 60000);
    const hasConflict = booked.some(
      (b) => cursor < b.endsAt! && slotEnd > b.startsAt!,
    );
    if (!hasConflict) {
      slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
    }
    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  return jsonOk(slots);
});
