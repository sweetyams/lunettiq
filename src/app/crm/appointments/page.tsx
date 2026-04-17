import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { appointments, customersProjection, locations } from '@/lib/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';
import { AppointmentsClient } from './AppointmentsClient';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

async function fetchStaff() {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return [];
  try {
    const res = await fetch('https://api.clerk.com/v1/users?limit=50&order_by=-created_at', {
      headers: { Authorization: `Bearer ${secret}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || data || []).map((u: Record<string, unknown>) => ({
      id: u.id as string,
      firstName: u.first_name as string | null,
      lastName: u.last_name as string | null,
      imageUrl: u.image_url as string | null,
    }));
  } catch { return []; }
}

export default async function AppointmentsPage() {
  await requirePermission('org:appointments:read');
  const weekStart = getMonday(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [rows, staff, locationRows] = await Promise.all([
    db.select({
      appointment: appointments,
      customerFirstName: customersProjection.firstName,
      customerLastName: customersProjection.lastName,
    })
    .from(appointments)
    .leftJoin(customersProjection, eq(appointments.shopifyCustomerId, customersProjection.shopifyCustomerId))
    .where(and(gte(appointments.startsAt, weekStart), lt(appointments.startsAt, weekEnd)))
    .orderBy(appointments.startsAt),
    fetchStaff(),
    db.select({ id: locations.id, name: locations.name }).from(locations).where(eq(locations.active, true)),
  ]);

  const events = rows.map(r => ({
    id: r.appointment.id,
    title: r.appointment.title,
    customerName: [r.customerFirstName, r.customerLastName].filter(Boolean).join(' ') || null,
    customerId: r.appointment.shopifyCustomerId,
    status: r.appointment.status ?? 'scheduled',
    startsAt: r.appointment.startsAt.toISOString(),
    endsAt: r.appointment.endsAt.toISOString(),
    staffId: r.appointment.staffId,
    locationId: r.appointment.locationId,
    notes: r.appointment.notes,
  }));

  return (
    <AppointmentsClient
      initialEvents={events}
      initialWeekStart={weekStart.toISOString()}
      staff={staff}
      locations={locationRows}
    />
  );
}
