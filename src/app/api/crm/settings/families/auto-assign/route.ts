export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection, productFamilies, productFamilyMembers } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';

const TYPE_SUFFIXES = ['opt', 'optics', 'sun', 'sunglasses'];

function parseHandle(handle: string) {
  const parts = handle.split('-');
  let family: string | null = null;
  let type: string | null = null;
  let colour: string | null = null;

  const typeIdx = parts.findIndex(p => p === 'opt' || p === 'sun');
  if (typeIdx >= 0 && typeIdx < parts.length - 1) {
    family = parts.slice(0, typeIdx).join('-');
    type = parts[typeIdx] === 'opt' ? 'optical' : 'sun';
    colour = parts.slice(typeIdx + 1).join('-');
  } else {
    const cIdx = parts.indexOf('©');
    if (cIdx >= 0 && cIdx < parts.length - 1) {
      family = parts.slice(0, cIdx).join('-');
      let tail = parts.slice(cIdx + 1);
      if (tail.length > 1 && /^\d+$/.test(tail[tail.length - 1])) tail = tail.slice(0, -1);
      if (tail.length > 1 && TYPE_SUFFIXES.includes(tail[tail.length - 1])) {
        type = tail[tail.length - 1] === 'sun' || tail[tail.length - 1] === 'sunglasses' ? 'sun' : 'optical';
        tail = tail.slice(0, -1);
      } else {
        type = 'optical';
      }
      colour = tail.join('-');
    }
  }
  return { family, type, colour };
}

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:business_config');

  // Get all unassigned, non-archived products
  const unassigned = await db.execute(sql`
    SELECT p.shopify_product_id as id, p.handle, p.title
    FROM products_projection p
    WHERE COALESCE(p.status, 'active') != 'archived'
    AND NOT EXISTS (SELECT 1 FROM product_family_members m WHERE m.product_id = p.shopify_product_id)
    ORDER BY p.handle
  `);

  let assigned = 0;
  let created = 0;

  for (const row of unassigned.rows as { id: string; handle: string; title: string }[]) {
    const { family, type, colour } = parseHandle(row.handle);
    if (!family) continue;

    // Create family if it doesn't exist
    const [existing] = await db.select().from(productFamilies).where(eq(productFamilies.id, family));
    if (!existing) {
      const name = family.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      await db.insert(productFamilies).values({ id: family, name }).onConflictDoNothing();
      created++;
    }

    await db.insert(productFamilyMembers)
      .values({ familyId: family, productId: row.id, type, colour, colourHex: null, sortOrder: 0 })
      .onConflictDoNothing();
    assigned++;
  }

  // Regenerate slugs
  const { regenerateAllSlugs } = await import('@/lib/crm/regenerate-slugs');
  await regenerateAllSlugs();

  return jsonOk({ message: `Assigned ${assigned} products, created ${created} new families` });
});
