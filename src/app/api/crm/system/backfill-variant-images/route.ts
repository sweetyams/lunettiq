export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection, productVariantsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql, eq } from 'drizzle-orm';

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

/**
 * Fetches variant images directly from Shopify Admin API.
 * Each variant has its own image_id — we resolve it to the actual image URL.
 */
export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  if (!SHOP || !TOKEN) return jsonOk({ message: 'Missing Shopify credentials' });

  const products = await db.select({ id: productsProjection.shopifyProductId })
    .from(productsProjection).where(sql`${productsProjection.status} = 'active'`);

  let updated = 0, errors = 0;

  for (const p of products) {
    try {
      const res = await fetch(`https://${SHOP}/admin/api/2024-10/products/${p.id}.json?fields=id,variants,images`, {
        headers: { 'X-Shopify-Access-Token': TOKEN },
      });
      if (!res.ok) { errors++; continue; }
      const { product } = await res.json();
      if (!product) continue;

      const imageMap = new Map<number, string>();
      for (const img of product.images ?? []) imageMap.set(img.id, img.src);

      for (const v of product.variants ?? []) {
        const imageUrl = v.image_id ? imageMap.get(v.image_id) ?? null : null;
        // Fall back to first image if variant has no specific image
        const finalUrl = imageUrl ?? (product.images?.[0]?.src ?? null);
        if (finalUrl) {
          await db.update(productVariantsProjection)
            .set({ imageUrl: finalUrl })
            .where(eq(productVariantsProjection.shopifyVariantId, String(v.id)));
          updated++;
        }
      }
    } catch { errors++; }
  }

  return jsonOk({ message: `Synced ${updated} variant images from Shopify (${errors} errors)` });
});
