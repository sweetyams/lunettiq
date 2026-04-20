export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { appointments, staffSchedules, locations } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, gte, lt, sql, SQL } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth();
  const params = request.nextUrl.searchParams;

  const dateStr = params.get('date');
  if (!dateStr) return jsonError('date is required', 400);

  const staffId = params.get('staffId');
  const locationId = params.get('locationId');
  if (!staffId && !locationId) return jsonError('staffId or locationId is required', 400);

  const duration = Number(params.get('duration') ?? 30);
  const buffer = Number(params.get('buffer') ?? 0);
  const day = new Date(dateStr);
  const dayOfWeek = day.getDay();

  // Determine working windows
  let windows: { start: string; end: string }[];
  if (staffId) {
    const schedule = await db.select().from(staffSchedules)
      .where(and(eq(staffSchedules.staffId, staffId), eq(staffSchedules.dayOfWeek, dayOfWeek)));
    windows = schedule.length > 0
      ? schedule.map(s => ({ start: s.startTime, end: s.endTime }))
      : [{ start: '09:00', end: '18:00' }];
  } else {
    windows = [{ start: '09:00', end: '18:00' }];
  }

  // Get booked appointments
  const dayStart = new Date(dateStr); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dateStr); dayEnd.setHours(23, 59, 59, 999);

  const conditions: SQL[] = [
    lt(appointments.startsAt, dayEnd),
    gte(appointments.endsAt, dayStart),
    sql`${appointments.status} NOT IN ('cancelled')`,
  ];
  if (staffId) conditions.push(eq(appointments.staffId, staffId));
  if (locationId) conditions.push(eq(appointments.locationId, locationId));

  const booked = await db
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
    .from(appointments)
    .where(and(...conditions));

  // Get capacity (for location-based mode)
  let capacity = 1;
  if (!staffId && locationId) {
    const loc = await db.select({ maxConcurrent: locations.maxConcurrent }).from(locations)
      .where(eq(locations.id, locationId)).then(r => r[0]);
    capacity = loc?.maxConcurrent ?? 1;
  }

  // Generate slots
  const slots: { start: string; end: string }[] = [];
  for (const w of windows) {
    const [sh, sm] = w.start.split(':').map(Number);
    const [eh, em] = w.end.split(':').map(Number);
    const winStart = new Date(dateStr); winStart.setHours(sh, sm, 0, 0);
    const winEnd = new Date(dateStr); winEnd.setHours(eh, em, 0, 0);

    const cursor = new Date(winStart);
    while (cursor.getTime() + duration * 60000 <= winEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + duration * 60000);
      const conflicts = booked.filter(b => {
        const bStart = new Date(b.startsAt!.getTime() - buffer * 60000);
        const bEnd = new Date(b.endsAt!.getTime() + buffer * 60000);
        return cursor < bEnd && slotEnd > bStart;
      }).length;
      if (conflicts < capacity) {
        slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
      }
      cursor.setMinutes(cursor.getMinutes() + 30);
    }
  }

  return jsonOk(slots);
});
