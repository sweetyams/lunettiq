export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { brandEvents, eventInvites, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc, sql, and } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth();
  const events = await db.select().from(brandEvents).orderBy(desc(brandEvents.startsAt));
  const withCounts = await Promise.all(events.map(async e => {
    const invites = await db.select({ status: eventInvites.status, count: sql<number>`count(*)` })
      .from(eventInvites).where(eq(eventInvites.eventId, e.id)).groupBy(eventInvites.status);
    const counts: Record<string, number> = {};
    for (const i of invites) counts[i.status ?? ''] = Number(i.count);
    return { ...e, inviteCounts: counts };
  }));
  return jsonOk(withCounts);
});

export const POST = handler(async (req) => {
  const session = await requireCrmAuth('org:settings:business_config');
  const body = await req.json();
  const [row] = await db.insert(brandEvents).values({
    title: body.title, description: body.description, location: body.location,
    startsAt: new Date(body.startsAt), endsAt: body.endsAt ? new Date(body.endsAt) : null,
    capacity: body.capacity, tierMinimum: body.tierMinimum ?? 'vault',
    status: body.status ?? 'draft', imageUrl: body.imageUrl, createdBy: session.userId,
  }).returning();
  return jsonOk(row, 201);
});
