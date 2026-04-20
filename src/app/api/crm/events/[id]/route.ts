export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { brandEvents, eventInvites, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';

export const GET = handler(async (_req, ctx) => {
  await requireCrmAuth();
  const event = await db.select().from(brandEvents).where(eq(brandEvents.id, ctx.params.id)).then(r => r[0]);
  if (!event) return jsonError('Not found', 404);

  const invites = await db.select({
    invite: eventInvites,
    firstName: customersProjection.firstName,
    lastName: customersProjection.lastName,
    email: customersProjection.email,
  }).from(eventInvites)
    .leftJoin(customersProjection, eq(eventInvites.shopifyCustomerId, customersProjection.shopifyCustomerId))
    .where(eq(eventInvites.eventId, ctx.params.id));

  return jsonOk({ event, invites: invites.map(i => ({ ...i.invite, name: [i.firstName, i.lastName].filter(Boolean).join(' '), email: i.email })) });
});

export const PATCH = handler(async (req, ctx) => {
  await requireCrmAuth('org:settings:business_config');
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.location !== undefined) updates.location = body.location;
  if (body.startsAt !== undefined) updates.startsAt = new Date(body.startsAt);
  if (body.status !== undefined) updates.status = body.status;
  if (body.capacity !== undefined) updates.capacity = body.capacity;
  const [row] = await db.update(brandEvents).set(updates).where(eq(brandEvents.id, ctx.params.id)).returning();
  return jsonOk(row);
});

// POST /api/crm/events/[id] — add invites
export const POST = handler(async (req, ctx) => {
  await requireCrmAuth('org:settings:business_config');
  const { customerIds } = await req.json();
  if (!Array.isArray(customerIds)) return jsonError('customerIds array required', 400);

  const values = customerIds.map((cid: string) => ({ eventId: ctx.params.id, shopifyCustomerId: cid }));
  const rows = await db.insert(eventInvites).values(values).onConflictDoNothing().returning();

  // Notify invited members
  const { fireKlaviyoEvent } = await import('@/lib/klaviyo/events');
  const event = await db.select().from(brandEvents).where(eq(brandEvents.id, ctx.params.id)).then(r => r[0]);
  for (const cid of customerIds) {
    const cust = await db.select({ email: customersProjection.email, firstName: customersProjection.firstName })
      .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, cid)).then(r => r[0]);
    if (cust?.email && event) {
      await fireKlaviyoEvent(cust.email, 'Event Invitation', {
        event_title: event.title, event_date: event.startsAt?.toISOString(), event_location: event.location, first_name: cust.firstName,
      });
    }
  }

  return jsonOk({ invited: rows.length });
});
