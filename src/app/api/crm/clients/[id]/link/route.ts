import { db } from '@/lib/db';
import { clientLinks, customersProjection, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, or, sql } from 'drizzle-orm';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:clients:read');
  const id = ctx.params.id;

  const links = await db
    .select()
    .from(clientLinks)
    .where(or(eq(clientLinks.clientA, id), eq(clientLinks.clientB, id)));

  const linkedIds = links.map(l => l.clientA === id ? l.clientB : l.clientA);
  if (!linkedIds.length) return jsonOk([]);

  const clients = await db
    .select({
      id: customersProjection.shopifyCustomerId,
      firstName: customersProjection.firstName,
      lastName: customersProjection.lastName,
      email: customersProjection.email,
    })
    .from(customersProjection)
    .where(sql`${customersProjection.shopifyCustomerId} = ANY(${linkedIds})`);

  const clientMap = new Map(clients.map(c => [c.id, c]));
  const result = links.map(l => {
    const otherId = l.clientA === id ? l.clientB : l.clientA;
    return { linkId: l.id, relationship: l.relationship, client: clientMap.get(otherId) ?? { id: otherId } };
  });

  return jsonOk(result);
});

export const POST = handler(async (request, ctx) => {
  const session = await requireCrmAuth('org:clients:update');
  const id = ctx.params.id;
  const { linkedClientId, relationship } = await request.json();

  if (!linkedClientId || !relationship) return jsonError('linkedClientId and relationship required', 400);

  const [row] = await db.insert(clientLinks).values({
    clientA: id, clientB: linkedClientId, relationship, createdBy: session.userId,
  }).returning();

  await db.insert(auditLog).values({
    action: 'create', entityType: 'client_link', entityId: row.id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: { clientA: id, clientB: linkedClientId, relationship },
  });

  return jsonOk(row, 201);
});
