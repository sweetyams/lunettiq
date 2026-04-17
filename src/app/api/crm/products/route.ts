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
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 100), 200);

  const conditions = [];
  if (q) conditions.push(ilike(productsProjection.title, `%${q}%`));
  if (type) conditions.push(ilike(productsProjection.productType, type));
  if (vendor) conditions.push(ilike(productsProjection.vendor, vendor));
  if (material) conditions.push(sql`${productsProjection.metafields}->'custom'->>'material' ILIKE ${material} OR ${productsProjection.metafields}->'custom'->>'acetate_source' ILIKE ${'%' + material + '%'}`);
  if (rx === 'true') conditions.push(sql`${productsProjection.metafields}->'custom'->>'rx_compatible' = 'true'`);
  if (rx === 'false') conditions.push(sql`(${productsProjection.metafields}->'custom'->>'rx_compatible' IS NULL OR ${productsProjection.metafields}->'custom'->>'rx_compatible' != 'true')`);
  const where = conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  const rows = await db.select().from(productsProjection).where(where).limit(limit);

  // Load variants for inventory + variant info
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

  const data = rows.map(r => ({
    ...r,
    imageUrl: (() => { const imgs = (r.images ?? []) as Array<string | { src?: string }>; return typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null; })(),
    totalInventory: inventoryMap.get(r.shopifyProductId) ?? 0,
    variants: variantMap.get(r.shopifyProductId) ?? [],
  }));

  return jsonOk(data);
});
