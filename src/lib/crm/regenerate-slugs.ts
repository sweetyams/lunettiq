import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { toSlug } from '@/lib/shopify/slug';

/**
 * Regenerate slugs for all products in a family using family name + colour + type.
 * Produces: "shelby-black", "shelby-black-sun", "june-blue", "june-blue-sun"
 * Falls back to toSlug(handle) for products not in any family.
 */
export async function regenerateFamilySlugs(familyId: string) {
  const rows = await db.execute(sql`
    SELECT m.product_id, f.name as family_name, m.colour, m.type, p.handle
    FROM product_family_members m
    JOIN product_families f ON f.id = m.family_id
    JOIN products_projection p ON p.shopify_product_id = m.product_id
    WHERE m.family_id = ${familyId}
    ORDER BY m.sort_order
  `);

  const seen = new Map<string, number>();

  for (const r of rows.rows as any[]) {
    const base = [r.family_name, r.colour, r.type === 'sun' ? 'sun' : null]
      .filter(Boolean)
      .join('-');
    let slug = toSlug(base);

    // Handle collisions within the family
    const count = seen.get(slug) ?? 0;
    if (count > 0) slug = `${slug}-${count + 1}`;
    seen.set(toSlug(base), count + 1);

    await db.update(productsProjection)
      .set({ slug })
      .where(eq(productsProjection.shopifyProductId, r.product_id));
  }
}

/**
 * Regenerate slugs for ALL products in ALL families, plus handle-based slugs for unassigned products.
 */
export async function regenerateAllSlugs() {
  // Family products
  const families = await db.execute(sql`SELECT DISTINCT family_id FROM product_family_members`);
  for (const f of families.rows as any[]) {
    await regenerateFamilySlugs(f.family_id);
  }

  // Non-family products: fall back to toSlug(handle)
  const unassigned = await db.execute(sql`
    SELECT p.shopify_product_id, p.handle
    FROM products_projection p
    WHERE NOT EXISTS (SELECT 1 FROM product_family_members m WHERE m.product_id = p.shopify_product_id)
    AND p.handle IS NOT NULL
  `);

  const seen = new Map<string, number>();
  // First pass: collect all family slugs to avoid collisions
  const existing = await db.execute(sql`
    SELECT slug FROM products_projection WHERE slug IS NOT NULL
    AND shopify_product_id IN (SELECT product_id FROM product_family_members)
  `);
  for (const r of existing.rows as any[]) {
    seen.set(r.slug, (seen.get(r.slug) ?? 0) + 1);
  }

  for (const r of unassigned.rows as any[]) {
    let slug = toSlug(r.handle);
    const count = seen.get(slug) ?? 0;
    if (count > 0) slug = `${slug}-${count + 1}`;
    seen.set(toSlug(r.handle), count + 1);

    await db.update(productsProjection)
      .set({ slug })
      .where(eq(productsProjection.shopifyProductId, r.shopify_product_id));
  }
}
