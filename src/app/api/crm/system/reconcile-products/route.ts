export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql, inArray } from 'drizzle-orm';
import { getKey } from '@/lib/crm/integration-keys';

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');

  const token = await getKey('SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  const domain = await getKey('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN');
  if (!token || !domain) return jsonError('Shopify not configured', 500);

  const allProducts = await db.select({ id: productsProjection.shopifyProductId, handle: productsProjection.handle })
    .from(productsProjection).where(eq(productsProjection.status, 'active'));

  const missing: string[] = [];

  // Check in batches of 20 via handle lookups
  for (let i = 0; i < allProducts.length; i += 20) {
    const batch = allProducts.slice(i, i + 20);
    const aliases = batch.map((p, idx) => `p${idx}: product(handle: "${p.handle}") { id }`).join(' ');
    const res = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Shopify-Storefront-Private-Token': token },
      body: JSON.stringify({ query: `{ ${aliases} }` }),
    });
    const data = await res.json();
    for (let j = 0; j < batch.length; j++) {
      if (!data.data?.[`p${j}`]) missing.push(batch[j].id);
    }
  }

  if (missing.length > 0) {
    await db.update(productsProjection).set({ status: 'archived' }).where(inArray(productsProjection.shopifyProductId, missing));
  }

  return jsonOk({ message: `Checked ${allProducts.length} products. Archived ${missing.length} not on storefront.` });
});
