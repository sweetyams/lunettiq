export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql, inArray } from 'drizzle-orm';

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  if (!SHOP || !TOKEN) return jsonError('Shopify not configured', 500);

  const allProducts = await db.select({ id: productsProjection.shopifyProductId })
    .from(productsProjection)
    .where(sql`${productsProjection.status} = 'active' AND ${productsProjection.shopifyProductId} NOT LIKE 'sq__%'`);

  const missing: string[] = [];

  // Check in batches via Admin REST API (by ID, not handle)
  for (let i = 0; i < allProducts.length; i += 50) {
    const batch = allProducts.slice(i, i + 50);
    const ids = batch.map(p => p.id).join(',');
    const res = await fetch(`https://${SHOP}/admin/api/2024-10/products.json?ids=${ids}&fields=id&limit=250`, {
      headers: { 'X-Shopify-Access-Token': TOKEN! },
    });
    if (!res.ok) continue;
    const { products } = await res.json();
    const foundIds = new Set((products ?? []).map((p: any) => String(p.id)));
    for (const p of batch) {
      if (!foundIds.has(p.id)) missing.push(p.id);
    }
  }

  if (missing.length > 0) {
    await db.update(productsProjection).set({ status: 'archived' }).where(inArray(productsProjection.shopifyProductId, missing));
  }

  return jsonOk({ message: `Checked ${allProducts.length} products. Archived ${missing.length} not on Shopify.` });
});
