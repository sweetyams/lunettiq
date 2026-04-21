export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';

export const POST = handler(async (_request, ctx) => {
  await requireCrmAuth('org:products:read');
  const productId = ctx.params.id;

  // Get handle from DB
  const product = await db.select({ handle: productsProjection.handle })
    .from(productsProjection).where(eq(productsProjection.shopifyProductId, productId)).then(r => r[0]);
  if (!product?.handle) return jsonError('Product not found', 404);

  // Fetch fresh metafields from Shopify by handle
  const shop = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  const r = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{ productByHandle(handle: "${product.handle}") { metafields(first: 50) { nodes { namespace key value } } } }` }),
  });
  const data = await r.json();
  const mfs = data.data?.productByHandle?.metafields?.nodes;
  if (!mfs) return jsonError('Could not fetch from Shopify', 502);

  // Group and remap
  const grouped: Record<string, Record<string, string>> = {};
  for (const mf of mfs) {
    if (!grouped[mf.namespace]) grouped[mf.namespace] = {};
    grouped[mf.namespace][mf.key] = mf.value;
  }
  // Remap udesly
  if (grouped.udesly) {
    if (!grouped.custom) grouped.custom = {};
    const remap: Record<string, string> = { swatch: 'swatch', 'short-name': 'short_name', description: 'short_description', season: 'season', 'face-shape-recommendation': 'face_shapes', 'available-in-these-colors': 'sibling_colours', 'alter-ego': 'alter_ego', featured: 'featured', latest: 'latest', 'ben-s-favourites': 'staff_pick' };
    for (const [oldKey, newKey] of Object.entries(remap)) {
      if (grouped.udesly[oldKey] && !grouped.custom[newKey]) grouped.custom[newKey] = grouped.udesly[oldKey];
    }
    delete grouped.udesly;
  }

  await db.update(productsProjection).set({ metafields: grouped }).where(eq(productsProjection.shopifyProductId, productId));

  return jsonOk({ synced: true, fields: Object.keys(grouped.custom ?? {}).length });
});
