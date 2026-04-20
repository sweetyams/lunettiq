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
  const sort = url.searchParams.get('sort') ?? 'name';
  const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const offset = Number(url.searchParams.get('offset') ?? 0);

  const conditions = [];
  // Hide merged customers
  conditions.push(sql`NOT EXISTS (SELECT 1 FROM unnest(COALESCE(${customersProjection.tags}, '{}')) AS t(v) WHERE v LIKE 'merged%')`);

  if (search) {
    const q = search.trim();
    const pattern = '%' + q + '%';
    conditions.push(sql`(
      ${customersProjection.firstName} ILIKE ${pattern}
      OR ${customersProjection.lastName} ILIKE ${pattern}
      OR ${customersProjection.email} ILIKE ${pattern}
      OR ${customersProjection.phone} ILIKE ${pattern}
      OR (${customersProjection.firstName} || ' ' || ${customersProjection.lastName}) ILIKE ${pattern}
    )`);
  }
  if (tag) {
    conditions.push(sql`${tag} = ANY(${customersProjection.tags})`);
  }

  const source = url.searchParams.get('source');
  if (source === 'square') {
    conditions.push(sql`${customersProjection.shopifyCustomerId} LIKE 'sq_%'`);
  } else if (source === 'shopify') {
    conditions.push(sql`${customersProjection.shopifyCustomerId} NOT LIKE 'sq_%'`);
  }

  const where = conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  // Sort: by similarity when searching, otherwise by chosen column
  const SORT_COLS: Record<string, any> = {
    name: customersProjection.lastName,
    email: customersProjection.email,
    orders: customersProjection.orderCount,
    ltv: customersProjection.totalSpent,
  };

  let orderBy;
  if (search) {
    const q = search.trim();
    // Rank exact prefix matches first, then by last name
    orderBy = sql`(
      CASE WHEN ${customersProjection.firstName} ILIKE ${q + '%'} OR ${customersProjection.lastName} ILIKE ${q + '%'} THEN 0 ELSE 1 END
    ) ASC, ${customersProjection.lastName} ASC NULLS LAST`;
  } else {
    const col = SORT_COLS[sort] ?? customersProjection.lastName;
    orderBy = dir === 'asc' ? sql`${col} ASC NULLS LAST` : sql`${col} DESC NULLS LAST`;
  }

  const [clients, countResult] = await Promise.all([
    db.select().from(customersProjection).where(where).orderBy(orderBy).limit(limit).offset(offset),
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
