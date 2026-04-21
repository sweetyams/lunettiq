export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productFamilies, productFamilyMembers } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';
import { regenerateFamilySlugs } from '@/lib/crm/regenerate-slugs';

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
  const unassigned = await db.execute(sql`
    SELECT p.shopify_product_id as id, p.handle, p.title, p.images->0->>'src' as image, p.status
    FROM products_projection p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_family_members m WHERE m.product_id = p.shopify_product_id
    )
    ORDER BY p.title
  `);
  return jsonOk({ families, members: members.rows, unassigned: unassigned.rows });
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
    await regenerateFamilySlugs(id);
    return jsonOk({ id });
  }

  if (body.action === 'add-member') {
    const { familyId, productId, type, colour, colourHex, sortOrder } = body;
    if (!familyId || !productId) return jsonError('familyId, productId required', 400);
    await db.insert(productFamilyMembers)
      .values({ familyId, productId, type: type ?? null, colour: colour ?? null, colourHex: colourHex ?? null, sortOrder: sortOrder ?? 0 })
      .onConflictDoNothing();
    await regenerateFamilySlugs(familyId);
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
    // Get familyId to regenerate slugs
    const [member] = await db.select({ familyId: productFamilyMembers.familyId }).from(productFamilyMembers).where(eq(productFamilyMembers.id, id));
    if (member) await regenerateFamilySlugs(member.familyId);
    return jsonOk({ updated: id });
  }

  return jsonError('Unknown action. Use: upsert-family, add-member, update-member', 400);
});

// DELETE — remove family or member
export const DELETE = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const body = await request.json();

  if (body.familyId && !body.memberId) {
    // Get member product IDs before deleting so we can reset their slugs
    const members = await db.select({ productId: productFamilyMembers.productId })
      .from(productFamilyMembers).where(eq(productFamilyMembers.familyId, body.familyId));
    await db.delete(productFamilyMembers).where(eq(productFamilyMembers.familyId, body.familyId));
    await db.delete(productFamilies).where(eq(productFamilies.id, body.familyId));
    // Reset removed members to handle-based slugs
    const { toSlug } = await import('@/lib/shopify/slug');
    const { productsProjection } = await import('@/lib/db/schema');
    for (const m of members) {
      const [p] = await db.select({ handle: productsProjection.handle }).from(productsProjection)
        .where(eq(productsProjection.shopifyProductId, m.productId));
      if (p?.handle) await db.update(productsProjection).set({ slug: toSlug(p.handle) })
        .where(eq(productsProjection.shopifyProductId, m.productId));
    }
    return jsonOk({ deleted: body.familyId });
  }

  if (body.memberId) {
    // Get member info before deleting
    const [member] = await db.select({ familyId: productFamilyMembers.familyId, productId: productFamilyMembers.productId })
      .from(productFamilyMembers).where(eq(productFamilyMembers.id, body.memberId));
    await db.delete(productFamilyMembers).where(eq(productFamilyMembers.id, body.memberId));
    if (member) {
      // Regenerate remaining family members' slugs
      await regenerateFamilySlugs(member.familyId);
      // Reset removed product to handle-based slug
      const { toSlug } = await import('@/lib/shopify/slug');
      const { productsProjection } = await import('@/lib/db/schema');
      const [p] = await db.select({ handle: productsProjection.handle }).from(productsProjection)
        .where(eq(productsProjection.shopifyProductId, member.productId));
      if (p?.handle) await db.update(productsProjection).set({ slug: toSlug(p.handle) })
        .where(eq(productsProjection.shopifyProductId, member.productId));
    }
    return jsonOk({ deleted: body.memberId });
  }

  return jsonError('Provide familyId or memberId', 400);
});
