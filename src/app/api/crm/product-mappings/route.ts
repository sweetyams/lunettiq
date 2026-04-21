export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productMappings, productsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql, desc } from 'drizzle-orm';

// GET: list all mappings with Shopify product titles
export const GET = handler(async (request) => {
  await requireCrmAuth();
  const params = request.nextUrl.searchParams;
  const status = params.get('status'); // 'auto' | 'unmatched' | 'manual' | 'confirmed' | 'ignored'
  const search = params.get('q');
  const offset = Number(params.get('offset') ?? 0);
  const limit = Math.min(Number(params.get('limit') ?? 50), 200);

  let query = sql`
    SELECT m.*, p.title as shopify_title, p.handle as shopify_handle, p.product_type as shopify_type,
      p.images::jsonb->0->>'src' as shopify_image,
      fm.type as family_type, fm.colour as family_colour, f.name as family_name
    FROM product_mappings m
    LEFT JOIN products_projection p ON p.shopify_product_id = m.shopify_product_id
    LEFT JOIN product_family_members fm ON fm.product_id = m.shopify_product_id
    LEFT JOIN product_families f ON f.id = COALESCE(m.family_id, fm.family_id)
    WHERE 1=1
  `;

  if (status && !search) query = sql`${query} AND m.status = ${status}`;
  if (search) query = sql`${query} AND (m.square_name ILIKE ${'%' + search + '%'} OR p.title ILIKE ${'%' + search + '%'} OR p.handle ILIKE ${'%' + search + '%'} OR m.parsed_frame ILIKE ${'%' + search + '%'} OR m.parsed_colour ILIKE ${'%' + search + '%'})`;

  query = sql`${query} ORDER BY m.confidence DESC NULLS LAST, m.square_name ASC LIMIT ${limit} OFFSET ${offset}`;

  const rows = await db.execute(query);

  // Stats
  const stats = await db.execute(sql`
    SELECT status, count(*) as count FROM product_mappings GROUP BY status
  `);

  return jsonOk({ mappings: rows.rows, stats: Object.fromEntries(stats.rows.map((r: any) => [r.status, Number(r.count)])) });
});

// PATCH: manual link, confirm, or confirm all auto
export const PATCH = handler(async (request) => {
  const session = await requireCrmAuth('org:settings:integrations');
  const body = await request.json();

  // Bulk confirm all auto-matched
  if (body.confirmAllAuto) {
    await db.update(productMappings).set({ status: 'confirmed', matchedBy: session.userId, updatedAt: new Date() }).where(eq(productMappings.status, 'auto'));
    return jsonOk({ confirmedAll: true });
  }

  // Bulk ignore all unmatched with no shopify product
  if (body.ignoreAllNoMatch) {
    await db.update(productMappings).set({ status: 'ignored', matchedBy: session.userId, updatedAt: new Date() })
      .where(sql`${productMappings.status} = 'unmatched' AND ${productMappings.shopifyProductId} IS NULL`);
    return jsonOk({ ignoredNoMatch: true });
  }

  const { squareCatalogId, shopifyProductId, shopifyVariantId, status, familyId } = body;

  if (!squareCatalogId) return jsonError('squareCatalogId required', 400);

  const set: Record<string, any> = { updatedAt: new Date(), matchedBy: session.userId };
  if (shopifyProductId !== undefined) set.shopifyProductId = shopifyProductId;
  if (shopifyVariantId !== undefined) set.shopifyVariantId = shopifyVariantId;
  if (familyId !== undefined) set.familyId = familyId;
  if (status) set.status = status;
  if (shopifyProductId) set.confidence = '1.00';

  await db.update(productMappings).set(set).where(eq(productMappings.squareCatalogId, squareCatalogId));

  return jsonOk({ updated: squareCatalogId });
});
