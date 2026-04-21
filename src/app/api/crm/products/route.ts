export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection, productVariantsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { ilike, sql, inArray } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth('org:products:read');
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const type = request.nextUrl.searchParams.get('type');
  const vendor = request.nextUrl.searchParams.get('vendor');
  const material = request.nextUrl.searchParams.get('material');
  const rx = request.nextUrl.searchParams.get('rx');
  const tag = request.nextUrl.searchParams.get('tag');
  const category = request.nextUrl.searchParams.get('category');
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 250), 300);

  const conditions = [];

  // Fuzzy search across title, vendor, and tags
  if (q) {
    const pattern = '%' + q.trim() + '%';
    conditions.push(sql`(
      ${productsProjection.title} ILIKE ${pattern}
      OR ${productsProjection.vendor} ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM unnest(${productsProjection.tags}) t WHERE t ILIKE ${pattern})
    )`);
  }

  if (type) conditions.push(ilike(productsProjection.productType, type));
  if (category) conditions.push(sql`${productsProjection.metafields}->'custom'->>'product_category' = ${category}`);
  if (vendor) conditions.push(ilike(productsProjection.vendor, vendor));
  if (material) conditions.push(sql`${productsProjection.metafields}->'custom'->>'material' ILIKE ${material} OR ${productsProjection.metafields}->'custom'->>'acetate_source' ILIKE ${'%' + material + '%'}`);
  if (rx === 'true') conditions.push(sql`${productsProjection.metafields}->'custom'->>'rx_compatible' = 'true'`);
  if (rx === 'false') conditions.push(sql`(${productsProjection.metafields}->'custom'->>'rx_compatible' IS NULL OR ${productsProjection.metafields}->'custom'->>'rx_compatible' != 'true')`);
  if (tag) conditions.push(sql`${tag} = ANY(${productsProjection.tags})`);

  const where = conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  // Order by similarity when searching, otherwise by title
  const orderBy = q
    ? sql`(CASE WHEN ${productsProjection.title} ILIKE ${q.trim() + '%'} THEN 0 ELSE 1 END) ASC, ${productsProjection.title} ASC`
    : sql`${productsProjection.title} ASC`;

  const rows = await db.select().from(productsProjection).where(where).orderBy(orderBy).limit(limit);

  // Load variants
  const productIds = rows.map(r => r.shopifyProductId);
  const variants = productIds.length
    ? await db.select().from(productVariantsProjection).where(inArray(productVariantsProjection.shopifyProductId, productIds))
    : [];

  const variantMap = new Map<string, Array<{ title: string | null; inventoryQuantity: number | null }>>();
  const inventoryMap = new Map<string, number>();
  for (const v of variants) {
    const pid = v.shopifyProductId!;
    if (!variantMap.has(pid)) variantMap.set(pid, []);
    variantMap.get(pid)!.push({ title: v.title, inventoryQuantity: v.inventoryQuantity });
    inventoryMap.set(pid, (inventoryMap.get(pid) ?? 0) + (v.inventoryQuantity ?? 0));
  }

  // Sales counts (direct + Square-linked)
  const salesMap = new Map<string, { units: number; squareUnits: number }>();
  if (productIds.length) {
    // Direct sales by product_id
    const directSales = await db.execute(sql`
      SELECT item->>'product_id' as pid, count(*) as units
      FROM orders_projection o, jsonb_array_elements(o.line_items) as item
      WHERE item->>'product_id' IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})
      GROUP BY 1
    `);
    for (const r of directSales.rows as any[]) {
      salesMap.set(r.pid, { units: Number(r.units), squareUnits: 0 });
    }

    // Square-linked sales
    const sqMappings = await db.execute(sql`
      SELECT shopify_product_id, lower(square_name) as sq_name
      FROM product_mappings
      WHERE shopify_product_id IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})
      AND status IN ('confirmed', 'auto', 'manual', 'related')
      AND square_name IS NOT NULL
    `);
    const pidBySqName = new Map<string, string>();
    for (const r of sqMappings.rows as any[]) {
      if (r.sq_name && r.shopify_product_id) pidBySqName.set(r.sq_name, r.shopify_product_id);
    }
    if (pidBySqName.size > 0) {
      const sqNames = Array.from(pidBySqName.keys());
      const sqSales = await db.execute(sql`
        SELECT lower(item->>'name') as name, count(*) as units
        FROM orders_projection o, jsonb_array_elements(o.line_items) as item
        WHERE lower(item->>'name') IN (${sql.join(sqNames.map(n => sql`${n}`), sql`, `)})
        GROUP BY 1
      `);
      for (const r of sqSales.rows as any[]) {
        const pid = pidBySqName.get(r.name);
        if (pid) {
          const existing = salesMap.get(pid) ?? { units: 0, squareUnits: 0 };
          existing.squareUnits += Number(r.units);
          salesMap.set(pid, existing);
        }
      }
    }
  }

  const data = rows.map(r => ({
    ...r,
    imageUrl: (() => { const imgs = (r.images ?? []) as Array<string | { src?: string }>; return typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null; })(),
    totalInventory: inventoryMap.get(r.shopifyProductId) ?? 0,
    variants: variantMap.get(r.shopifyProductId) ?? [],
    sales: salesMap.get(r.shopifyProductId) ?? { units: 0, squareUnits: 0 },
  }));

  return jsonOk(data);
});
