export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonList, jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { ilike, or, sql, desc } from 'drizzle-orm';
import { createCustomer } from '@/lib/crm/shopify-admin';
import { normalizeEmail, normalizePhone, normalizeName } from '@/lib/crm/normalize';

export const GET = handler(async (request) => {
  await requireCrmAuth();

  const url = request.nextUrl;
  const search = url.searchParams.get('q') ?? '';
  const tag = url.searchParams.get('tag');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  const conditions = [];
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(customersProjection.firstName, pattern),
        ilike(customersProjection.lastName, pattern),
        ilike(customersProjection.email, pattern),
        ilike(customersProjection.phone, pattern)
      )
    );
  }
  if (tag) {
    conditions.push(sql`${tag} = ANY(${customersProjection.tags})`);
  }

  const where = conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  const [clients, countResult] = await Promise.all([
    db.select().from(customersProjection).where(where).orderBy(desc(customersProjection.syncedAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(customersProjection).where(where),
  ]);

  return jsonList(clients, { total: Number(countResult[0]?.count ?? 0), limit, offset });
});

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:clients:create');
  const body = await request.json();

  const { firstName: rawFirst, lastName: rawLast, email: rawEmail, phone: rawPhone, tags, note } = body;
  const firstName = normalizeName(rawFirst);
  const lastName = normalizeName(rawLast);
  const email = normalizeEmail(rawEmail);
  const phone = normalizePhone(rawPhone);
  if (!firstName || !lastName) return jsonError('firstName and lastName required', 400);

  const result = await createCustomer({
    first_name: firstName,
    last_name: lastName,
    email: email || undefined,
    phone: phone || undefined,
    tags: Array.isArray(tags) ? tags.join(', ') : tags || undefined,
    note: note || undefined,
  });

  if (!result.ok) return jsonError(result.error, 502);

  const shopifyId = String(result.data);

  await db.insert(customersProjection).values({
    shopifyCustomerId: shopifyId,
    firstName, lastName,
    email: email || null,
    phone: phone || null,
    tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
    totalSpent: '0', orderCount: 0,
    acceptsMarketing: false, smsConsent: false,
    createdAt: new Date(), syncedAt: new Date(),
  }).onConflictDoNothing();

  await db.insert(auditLog).values({
    action: 'create', entityType: 'customer', entityId: shopifyId,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
  });

  const { notifyStaff } = await import('@/lib/crm/notify');
  await notifyStaff({ title: `New client: ${firstName} ${lastName}`, body: email || undefined, type: 'client', entityType: 'client', entityId: shopifyId });

  return jsonOk({ shopifyCustomerId: shopifyId }, 201);
});
