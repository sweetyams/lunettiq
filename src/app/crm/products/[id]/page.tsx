import { db } from '@/lib/db';
import { productsProjection, productVariantsProjection, productFamilyMembers } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ProductDetailClient } from './ProductDetailClient';
import { requirePermission } from '@/lib/crm/auth';

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  await requirePermission('org:products:read');
  const [product, variants] = await Promise.all([
    db.select().from(productsProjection).where(eq(productsProjection.shopifyProductId, params.id)).then(r => r[0]),
    db.select().from(productVariantsProjection).where(eq(productVariantsProjection.shopifyProductId, params.id)),
  ]);

  if (!product) notFound();

  // Get family siblings
  const siblings = await db.execute(sql`
    SELECT m.product_id, m.type, m.colour, m.colour_hex,
           p.shopify_product_id, p.handle, p.title, p.images->0->>'src' as image
    FROM product_family_members m
    JOIN products_projection p ON p.shopify_product_id = m.product_id
    WHERE m.family_id = (
      SELECT family_id FROM product_family_members WHERE product_id = ${params.id} LIMIT 1
    )
    AND p.status = 'active'
    ORDER BY m.sort_order
  `).then(r => r.rows).catch(() => []);

  // Look up real Shopify admin product ID by handle
  let shopifyAdminId: string | null = null;
  if (product.handle) {
    try {
      const shop = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
      const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
      const r = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `{ productByHandle(handle: "${product.handle}") { id } }` }),
        next: { revalidate: 3600 },
      });
      const data = await r.json();
      const gid = data?.data?.productByHandle?.id;
      if (gid) shopifyAdminId = gid.replace('gid://shopify/Product/', '');
    } catch {}
  }

  return (
    <ProductDetailClient
      product={JSON.parse(JSON.stringify(product))}
      variants={JSON.parse(JSON.stringify(variants))}
      siblings={JSON.parse(JSON.stringify(siblings))}
      shopifyAdminId={shopifyAdminId}
    />
  );
}
