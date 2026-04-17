import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection, ordersProjection, interactions, secondSightIntakes, appointments, preferencesDerived, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc } from 'drizzle-orm';
import { updateCustomer, updateCustomerMetafield } from '@/lib/crm/shopify-admin';
import { normalizeEmail, normalizePhone, normalizeName } from '@/lib/crm/normalize';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth();
  const id = ctx.params.id;

  const [client, orders, timeline, intakes, appts, prefs] = await Promise.all([
    db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]),
    db.select().from(ordersProjection).where(eq(ordersProjection.shopifyCustomerId, id)).orderBy(desc(ordersProjection.createdAt)).limit(10),
    db.select().from(interactions).where(eq(interactions.shopifyCustomerId, id)).orderBy(desc(interactions.occurredAt)).limit(50),
    db.select().from(secondSightIntakes).where(eq(secondSightIntakes.shopifyCustomerId, id)).orderBy(desc(secondSightIntakes.createdAt)),
    db.select().from(appointments).where(eq(appointments.shopifyCustomerId, id)).orderBy(desc(appointments.startsAt)),
    db.select().from(preferencesDerived).where(eq(preferencesDerived.shopifyCustomerId, id)).then(r => r[0]),
  ]);

  if (!client) return jsonError('Client not found', 404);
  return jsonOk({ client, orders, timeline, intakes, appointments: appts, preferences: prefs ?? null });
});

export const PATCH = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:clients:update');
  const id = ctx.params.id;
  const body = await request.json();

  // Core fields → Shopify customer update
  const coreFields: Record<string, string> = {};
  if (body.firstName !== undefined) coreFields.first_name = normalizeName(body.firstName) ?? body.firstName;
  if (body.lastName !== undefined) coreFields.last_name = normalizeName(body.lastName) ?? body.lastName;
  if (body.email !== undefined) coreFields.email = normalizeEmail(body.email) ?? body.email;
  if (body.phone !== undefined) coreFields.phone = normalizePhone(body.phone) ?? body.phone;

  if (Object.keys(coreFields).length) {
    const result = await updateCustomer(Number(id), coreFields);
    if (!result.ok) return jsonError(result.error, 502);
  }

  // Metafields → individual updates
  const metafields = body.metafields as Record<string, { value: string; type?: string }> | undefined;
  if (metafields) {
    for (const [key, meta] of Object.entries(metafields)) {
      await updateCustomerMetafield(Number(id), 'custom', key, meta.value, meta.type || 'single_line_text_field');
    }
  }

  // Optimistic projection update — use normalized values
  const updates: Record<string, unknown> = { syncedAt: new Date() };
  if (body.firstName !== undefined) updates.firstName = coreFields.first_name ?? body.firstName;
  if (body.lastName !== undefined) updates.lastName = coreFields.last_name ?? body.lastName;
  if (body.email !== undefined) updates.email = coreFields.email ?? body.email;
  if (body.phone !== undefined) updates.phone = coreFields.phone ?? body.phone;

  // Merge metafields into local JSONB so changes reflect immediately
  if (metafields) {
    const row = await db.select({ metafields: customersProjection.metafields }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]);
    const existing = (row?.metafields ?? {}) as Record<string, Record<string, string>>;
    const custom = { ...existing.custom };
    for (const [key, meta] of Object.entries(metafields)) {
      custom[key] = meta.value;
    }
    updates.metafields = { ...existing, custom };
  }

  await db.update(customersProjection).set(updates).where(eq(customersProjection.shopifyCustomerId, id));

  // Audit
  await db.insert(auditLog).values({
    action: 'update', entityType: 'customer', entityId: id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: body,
  });

  const updated = await db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]);
  return jsonOk(updated);
});
