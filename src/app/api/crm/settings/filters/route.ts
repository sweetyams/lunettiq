export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { filterGroups, productFilters } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, sql } from 'drizzle-orm';

// GET — list all filter groups + product assignments with product info
export const GET = handler(async (request) => {
  await requireCrmAuth();
  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  const groups = type
    ? await db.select().from(filterGroups).where(eq(filterGroups.type, type)).orderBy(filterGroups.sortOrder)
    : await db.select().from(filterGroups).orderBy(filterGroups.type, filterGroups.sortOrder);

  // Get assignments with product handles
  const assignments = await db.execute(sql`
    SELECT pf.id, pf.product_id, pf.filter_group_id, pf.status, pf.matched_by,
           p.handle, p.title, p.images->0->>'src' as image
    FROM product_filters pf
    JOIN products_projection p ON p.shopify_product_id = pf.product_id
    ${type ? sql`WHERE pf.filter_group_id LIKE ${type + ':%'}` : sql``}
    ORDER BY pf.filter_group_id, p.title
  `);

  // Get products with no assignment for this filter type (all statuses)
  const unassigned = type ? await db.execute(sql`
    SELECT p.shopify_product_id as id, p.handle, p.title, p.images->0->>'src' as image, p.status
    FROM products_projection p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_filters pf
      WHERE pf.product_id = p.shopify_product_id
      AND pf.filter_group_id LIKE ${type + ':%'}
    )
    ORDER BY p.title
  `) : null;

  return jsonOk({ groups, assignments: assignments.rows, unassigned: unassigned?.rows ?? [] });
});

// POST — create/update filter group OR assign product to filter
export const POST = handler(async (request) => {
  const user = await requireCrmAuth('org:settings:tags');
  const body = await request.json();

  // Create/update filter group
  if (body.action === 'upsert-group') {
    const { type, slug, label, sortOrder } = body;
    if (!type || !slug || !label) return jsonError('type, slug, label required', 400);
    const id = `${type}:${slug}`;
    await db.insert(filterGroups).values({ id, type, slug, label, sortOrder: sortOrder ?? 0 })
      .onConflictDoUpdate({ target: filterGroups.id, set: { label, sortOrder: sortOrder ?? 0 } });
    return jsonOk({ id });
  }

  // Assign product to filter group
  if (body.action === 'assign') {
    const { productId, filterGroupId, status } = body;
    if (!productId || !filterGroupId) return jsonError('productId, filterGroupId required', 400);
    await db.insert(productFilters)
      .values({ productId, filterGroupId, status: status ?? 'manual', matchedBy: user.userId })
      .onConflictDoUpdate({
        target: [productFilters.productId, productFilters.filterGroupId],
        set: { status: status ?? 'manual', matchedBy: user.userId },
      });
    return jsonOk({ productId, filterGroupId });
  }

  // Confirm auto-matched assignment
  if (body.action === 'confirm') {
    const { id } = body;
    if (!id) return jsonError('id required', 400);
    await db.update(productFilters).set({ status: 'confirmed', matchedBy: user.userId }).where(eq(productFilters.id, id));
    return jsonOk({ confirmed: id });
  }

  return jsonError('Unknown action. Use: upsert-group, assign, confirm', 400);
});

// DELETE — remove filter group or product assignment
export const DELETE = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const body = await request.json();

  if (body.filterGroupId && !body.productId) {
    // Delete entire filter group + its assignments
    await db.delete(productFilters).where(eq(productFilters.filterGroupId, body.filterGroupId));
    await db.delete(filterGroups).where(eq(filterGroups.id, body.filterGroupId));
    return jsonOk({ deleted: body.filterGroupId });
  }

  if (body.productId && body.filterGroupId) {
    // Remove single assignment
    await db.delete(productFilters).where(
      and(eq(productFilters.productId, body.productId), eq(productFilters.filterGroupId, body.filterGroupId))
    );
    return jsonOk({ deleted: true });
  }

  return jsonError('Provide filterGroupId (to delete group) or productId+filterGroupId (to remove assignment)', 400);
});
