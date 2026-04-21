export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productFamilies, productFamilyMembers } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';

// GET — list families with members
export const GET = handler(async () => {
  await requireCrmAuth();
  const families = await db.select().from(productFamilies).orderBy(productFamilies.name);
  const members = await db.execute(sql`
    SELECT m.*, p.handle, p.title, p.images->0->>'src' as image, p.status
    FROM product_family_members m
    JOIN products_projection p ON p.shopify_product_id = m.product_id
    ORDER BY m.family_id, m.sort_order
  `);
  return jsonOk({ families, members: members.rows });
});

// POST — create/update family or add member
export const POST = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const body = await request.json();

  if (body.action === 'upsert-family') {
    const { id, name } = body;
    if (!id || !name) return jsonError('id, name required', 400);
    await db.insert(productFamilies).values({ id, name })
      .onConflictDoUpdate({ target: productFamilies.id, set: { name } });
    return jsonOk({ id });
  }

  if (body.action === 'add-member') {
    const { familyId, productId, type, colour, colourHex, sortOrder } = body;
    if (!familyId || !productId) return jsonError('familyId, productId required', 400);
    await db.insert(productFamilyMembers)
      .values({ familyId, productId, type: type ?? null, colour: colour ?? null, colourHex: colourHex ?? null, sortOrder: sortOrder ?? 0 })
      .onConflictDoNothing();
    return jsonOk({ familyId, productId });
  }

  if (body.action === 'update-member') {
    const { id, type, colour, colourHex, sortOrder } = body;
    if (!id) return jsonError('id required', 400);
    await db.update(productFamilyMembers).set({
      ...(type !== undefined && { type }),
      ...(colour !== undefined && { colour }),
      ...(colourHex !== undefined && { colourHex }),
      ...(sortOrder !== undefined && { sortOrder }),
    }).where(eq(productFamilyMembers.id, id));
    return jsonOk({ updated: id });
  }

  return jsonError('Unknown action. Use: upsert-family, add-member, update-member', 400);
});

// DELETE — remove family or member
export const DELETE = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const body = await request.json();

  if (body.familyId && !body.memberId) {
    await db.delete(productFamilyMembers).where(eq(productFamilyMembers.familyId, body.familyId));
    await db.delete(productFamilies).where(eq(productFamilies.id, body.familyId));
    return jsonOk({ deleted: body.familyId });
  }

  if (body.memberId) {
    await db.delete(productFamilyMembers).where(eq(productFamilyMembers.id, body.memberId));
    return jsonOk({ deleted: body.memberId });
  }

  return jsonError('Provide familyId or memberId', 400);
});
