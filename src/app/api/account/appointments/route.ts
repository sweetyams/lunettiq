export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appointments, locations } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq, and, gte, lt, sql, desc } from 'drizzle-orm';

function extractId(gid: string): string {
  return gid.replace(/^gid:\/\/shopify\/Customer\//, '');
}

async function requireCustomer() {
  // Dev bypass
  if (process.env.DEV_CUSTOMER_ID && process.env.NODE_ENV !== 'production') {
    return { id: process.env.DEV_CUSTOMER_ID, name: 'Dev User' };
  }
  const token = getAccessToken();
  if (!token) throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await getCustomerProfile(token);
  return { id: extractId(profile.id), name: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() };
}

// GET /api/account/appointments — list customer's appointments
// GET /api/account/appointments?slots=1&date=2026-04-20&locationId=xxx — get available slots
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  // Slots mode: public, no auth needed
  if (params.get('slots')) {
    const dateStr = params.get('date');
    const locationId = params.get('locationId');
    if (!dateStr || !locationId) return NextResponse.json({ error: 'date and locationId required' }, { status: 400 });

    const duration = Number(params.get('duration') ?? 30);
    const dayStart = new Date(dateStr);
    dayStart.setHours(10, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(18, 0, 0, 0);

    // Skip past dates
    if (dayEnd.getTime() < Date.now()) return NextResponse.json({ data: [] });

    const booked = await db.select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
      .from(appointments)
      .where(and(
        eq(appointments.locationId, locationId),
        lt(appointments.startsAt, dayEnd),
        gte(appointments.endsAt, dayStart),
        sql`${appointments.status} NOT IN ('cancelled')`,
      ));

    const slots: { start: string; end: string }[] = [];
    const cursor = new Date(dayStart);
    while (cursor.getTime() + duration * 60000 <= dayEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + duration * 60000);
      if (cursor.getTime() > Date.now() && !booked.some(b => cursor < b.endsAt! && slotEnd > b.startsAt!)) {
        slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
      }
      cursor.setMinutes(cursor.getMinutes() + 30);
    }
    return NextResponse.json({ data: slots });
  }

  // List mode: requires auth
  try {
    const customer = await requireCustomer();
    const rows = await db.select().from(appointments)
      .where(eq(appointments.shopifyCustomerId, customer.id))
      .orderBy(desc(appointments.startsAt));

    // Enrich with location names
    const locs = await db.select().from(locations);
    const locMap = new Map(locs.map(l => [l.id, l.name]));

    const data = rows.map(r => ({ ...r, locationName: locMap.get(r.locationId ?? '') ?? r.locationId }));
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ error: 'Failed to load appointments' }, { status: 500 });
  }
}

// POST /api/account/appointments — book an appointment
export async function POST(request: NextRequest) {
  let customer;
  try { customer = await requireCustomer(); } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { locationId, startsAt, title, notes } = body;
  if (!locationId || !startsAt) return NextResponse.json({ error: 'locationId and startsAt required' }, { status: 400 });

  const start = new Date(startsAt);
  const end = new Date(start.getTime() + 30 * 60000);

  // Check for conflicts at this location
  const overlap = await db.select({ id: appointments.id }).from(appointments)
    .where(and(
      eq(appointments.locationId, locationId),
      lt(appointments.startsAt, end),
      gte(appointments.endsAt, start),
      sql`${appointments.status} NOT IN ('cancelled')`,
    )).limit(1);

  if (overlap.length) return NextResponse.json({ error: 'This time slot is no longer available' }, { status: 409 });

  const [row] = await db.insert(appointments).values({
    shopifyCustomerId: customer.id,
    title: title || 'Appointment',
    startsAt: start,
    endsAt: end,
    notes: notes || null,
    locationId,
  }).returning();

  return NextResponse.json({ data: row }, { status: 201 });
}
