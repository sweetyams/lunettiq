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
  if (category) conditions.push(sql`COALESCE(${productsProjection.metafields}->'custom'->>'product_type', ${productsProjection.metafields}->'custom'->>'product_category') = ${category}`);
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

  // Default: show only active products unless status param overrides
  const statusParam = request.nextUrl.searchParams.get('status');
  const statusFilter = statusParam === 'all'
    ? sql`1=1`
    : statusParam?.includes(',')
      ? sql`COALESCE(${productsProjection.status}, 'active') IN (${sql.join(statusParam.split(',').map(s => sql`${s.trim()}`), sql`, `)})`
      : statusParam
        ? sql`COALESCE(${productsProjection.status}, 'active') = ${statusParam}`
        : sql`COALESCE(${productsProjection.status}, 'active') = 'active'`;
  const finalWhere = where ? sql`${where} AND ${statusFilter}` : statusFilter;

  const rows = await db.select().from(productsProjection).where(finalWhere).orderBy(orderBy).limit(limit);

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

  // Sales counts (direct + Square-linked) via shared service
  const { getBulkProductSales } = await import('@/lib/crm/product-sales');
  const salesMap = productIds.length ? await getBulkProductSales(productIds) : new Map();

  const data = rows.map(r => ({
    ...r,
    imageUrl: (() => { const imgs = (r.images ?? []) as Array<string | { src?: string }>; return typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null; })(),
    totalInventory: inventoryMap.get(r.shopifyProductId) ?? 0,
    variants: variantMap.get(r.shopifyProductId) ?? [],
    sales: salesMap.get(r.shopifyProductId) ?? { units: 0, squareUnits: 0 },
  }));

  return jsonOk(data);
});
