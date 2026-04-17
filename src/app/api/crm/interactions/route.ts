export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { interactions, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonList, jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc, sql } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth();
  const customerId = request.nextUrl.searchParams.get('customerId');
  if (!customerId) return jsonError('customerId required', 400);

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 100), 200);
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0);
  const where = eq(interactions.shopifyCustomerId, customerId);

  const [rows, countResult] = await Promise.all([
    db.select().from(interactions).where(where).orderBy(desc(interactions.occurredAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(interactions).where(where),
  ]);

  return jsonList(rows, { total: Number(countResult[0]?.count ?? 0), limit, offset });
});

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:interactions:create');
  const body = await request.json();

  const [row] = await db.insert(interactions).values({
    shopifyCustomerId: body.shopifyCustomerId ?? body.customerId,
    type: body.type,
    direction: body.direction ?? 'internal',
    subject: body.subject,
    body: body.body,
    metadata: body.metadata,
    staffId: session.userId,
    locationId: session.locationIds[0],
    occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
  }).returning();

  await db.insert(auditLog).values({
    action: 'create', entityType: 'interaction', entityId: row.id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
  });

  return jsonOk(row, 201);
});
