export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { db } from '@/lib/db';
import { productsProjection, productVariantsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';
import { toSlug } from '@/lib/shopify/slug';
import { remapMetafields } from '@/lib/crm/metafield-schema';

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const GQL = `https://${SHOP}/admin/api/2024-10/graphql.json`;

function stripGid(gid: string) { return gid.replace(/^gid:\/\/shopify\/\w+\//, ''); }

const QUERY = `query($cursor: String) {
  products(first: 25, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title descriptionHtml productType vendor status tags
      createdAt updatedAt
      images(first: 10) { nodes { url altText } }
      variants(first: 50) { nodes { id title sku price inventoryQuantity compareAtPrice selectedOptions { name value } image { url } } }
      metafields(first: 30) { nodes { namespace key value } }
      priceRangeV2 { minVariantPrice { amount } maxVariantPrice { amount } }
    }
  }
}`;

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  if (!SHOP || !TOKEN) return jsonOk({ message: 'Missing Shopify credentials' });

  let cursor: string | null = null;
  let total = 0;

  while (true) {
    const res = await fetch(GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN! },
      body: JSON.stringify({ query: QUERY, variables: { cursor } }),
    });
    if (!res.ok) break;
    const { data } = await res.json();
    if (!data?.products) break;
    const { nodes, pageInfo } = data.products;

    for (const p of nodes) {
      const pid = stripGid(p.id);
      const metafields: Record<string, Record<string, string>> = {};
      for (const mf of p.metafields.nodes) {
        if (!metafields[mf.namespace]) metafields[mf.namespace] = {};
        metafields[mf.namespace][mf.key] = mf.value;
      }
      // Remap old keys to new canonical structure
      if (metafields.custom) metafields.custom = remapMetafields(metafields.custom);
      const images = p.images.nodes.map((i: any) => ({ src: i.url, alt: i.altText }));
      const status = p.status?.toLowerCase() === 'active' ? 'active' : p.status?.toLowerCase() === 'draft' ? 'draft' : 'archived';

      await db.insert(productsProjection).values({
        shopifyProductId: pid, handle: p.handle, title: p.title, description: p.descriptionHtml,
        productType: p.productType, vendor: p.vendor, status, tags: p.tags,
        images: images as any, metafields: metafields as any,
        priceMin: p.priceRangeV2.minVariantPrice.amount, priceMax: p.priceRangeV2.maxVariantPrice.amount,
        createdAt: new Date(p.createdAt), shopifyUpdatedAt: new Date(p.updatedAt), syncedAt: new Date(),
      }).onConflictDoUpdate({
        target: productsProjection.shopifyProductId,
        set: {
          handle: p.handle, title: p.title, description: p.descriptionHtml,
          productType: p.productType, vendor: p.vendor, status, tags: p.tags,
          images: images as any, metafields: metafields as any,
          priceMin: p.priceRangeV2.minVariantPrice.amount, priceMax: p.priceRangeV2.maxVariantPrice.amount,
          shopifyUpdatedAt: new Date(p.updatedAt), syncedAt: new Date(),
        },
      });

      // Slug: only set for non-family products (family slugs managed separately)
      const { productFamilyMembers } = await import('@/lib/db/schema');
      const [inFamily] = await db.select({ id: productFamilyMembers.id }).from(productFamilyMembers)
        .where(eq(productFamilyMembers.productId, pid)).limit(1);
      if (!inFamily) {
        await db.update(productsProjection).set({ slug: toSlug(p.handle) }).where(eq(productsProjection.shopifyProductId, pid));
      }

      for (const v of p.variants.nodes) {
        const vid = stripGid(v.id);
        const imageUrl = v.image?.url ?? images[0]?.src ?? null;
        await db.insert(productVariantsProjection).values({
          shopifyVariantId: vid, shopifyProductId: pid, title: v.title, sku: v.sku,
          price: v.price, compareAtPrice: v.compareAtPrice, inventoryQuantity: v.inventoryQuantity ?? 0,
          selectedOptions: v.selectedOptions as any, imageUrl, availableForSale: (v.inventoryQuantity ?? 0) > 0, syncedAt: new Date(),
        }).onConflictDoUpdate({
          target: productVariantsProjection.shopifyVariantId,
          set: {
            title: v.title, sku: v.sku, price: v.price, compareAtPrice: v.compareAtPrice,
            inventoryQuantity: v.inventoryQuantity ?? 0, selectedOptions: v.selectedOptions as any,
            imageUrl, availableForSale: (v.inventoryQuantity ?? 0) > 0, syncedAt: new Date(),
          },
        });
      }
    }

    total += nodes.length;
    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
  }

  // Re-link family members from archived→active products (handles Shopify product ID changes)
  // Also copy CRM-owned metafields (product_type/product_category etc) from archived to new active products
  await db.execute(sql`
    UPDATE products_projection new_p
    SET metafields = new_p.metafields || jsonb_build_object('custom',
      COALESCE(new_p.metafields->'custom', '{}'::jsonb) || COALESCE(old_p.metafields->'custom', '{}'::jsonb))
    FROM products_projection old_p
    WHERE old_p.handle = new_p.handle AND old_p.status = 'archived' AND new_p.status = 'active'
    AND COALESCE(old_p.metafields->'custom'->>'product_type', old_p.metafields->'custom'->>'product_category') IS NOT NULL
    AND COALESCE(new_p.metafields->'custom'->>'product_type', new_p.metafields->'custom'->>'product_category') IS NULL
  `);

  // Re-link product_mappings from archived→active
  await db.execute(sql`
    UPDATE product_mappings m
    SET shopify_product_id = new_p.shopify_product_id
    FROM products_projection old_p, products_projection new_p
    WHERE old_p.shopify_product_id = m.shopify_product_id
    AND old_p.status = 'archived' AND new_p.handle = old_p.handle AND new_p.status = 'active'
  `);

  // Re-link product_filters from archived→active
  await db.execute(sql`
    UPDATE product_filters pf
    SET product_id = new_p.shopify_product_id
    FROM products_projection old_p, products_projection new_p
    WHERE old_p.shopify_product_id = pf.product_id
    AND old_p.status = 'archived' AND new_p.handle = old_p.handle AND new_p.status = 'active'
  `);

  // Re-link product_colours from archived→active
  await db.execute(sql`
    UPDATE product_colours pc
    SET product_id = new_p.shopify_product_id
    FROM products_projection old_p, products_projection new_p
    WHERE old_p.shopify_product_id = pc.product_id
    AND old_p.status = 'archived' AND new_p.handle = old_p.handle AND new_p.status = 'active'
  `);

  const relinked = await db.execute(sql`
    SELECT m.id as member_id, m.family_id, m.product_id as old_id,
           new_p.shopify_product_id as new_id
    FROM product_family_members m
    JOIN products_projection old_p ON old_p.shopify_product_id = m.product_id AND old_p.status = 'archived'
    JOIN products_projection new_p ON new_p.handle = old_p.handle AND new_p.status = 'active'
    WHERE new_p.shopify_product_id != old_p.shopify_product_id
  `);
  let relinkCount = 0;
  for (const r of relinked.rows as any[]) {
    const [exists] = await db.execute(sql`SELECT id FROM product_family_members WHERE family_id = ${r.family_id} AND product_id = ${r.new_id}`).then(r => r.rows);
    if (exists) {
      await db.execute(sql`DELETE FROM product_family_members WHERE id = ${r.member_id}`);
    } else {
      await db.execute(sql`UPDATE product_family_members SET product_id = ${r.new_id} WHERE id = ${r.member_id}`);
      relinkCount++;
    }
  }

  // Clean up: remove archived products from relationship tables (no active replacement found)
  await db.execute(sql`
    DELETE FROM product_family_members WHERE product_id IN (
      SELECT m.product_id FROM product_family_members m
      JOIN products_projection p ON p.shopify_product_id = m.product_id
      WHERE p.status = 'archived'
      AND NOT EXISTS (SELECT 1 FROM products_projection p2 WHERE p2.handle = p.handle AND p2.status = 'active')
    )
  `);
  await db.execute(sql`
    DELETE FROM product_filters WHERE product_id IN (
      SELECT pf.product_id FROM product_filters pf
      JOIN products_projection p ON p.shopify_product_id = pf.product_id
      WHERE p.status = 'archived'
      AND NOT EXISTS (SELECT 1 FROM products_projection p2 WHERE p2.handle = p.handle AND p2.status = 'active')
    )
  `);
  await db.execute(sql`
    DELETE FROM product_colours WHERE product_id IN (
      SELECT pc.product_id FROM product_colours pc
      JOIN products_projection p ON p.shopify_product_id = pc.product_id
      WHERE p.status = 'archived'
      AND NOT EXISTS (SELECT 1 FROM products_projection p2 WHERE p2.handle = p.handle AND p2.status = 'active')
    )
  `);

  // Regenerate family slugs
  const { regenerateAllSlugs } = await import('@/lib/crm/regenerate-slugs');
  await regenerateAllSlugs();

  return jsonOk({ message: `Synced ${total} products, re-linked ${relinkCount} family members` });
});
