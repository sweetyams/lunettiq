export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth('org:products:read');

  const rows = await db.execute(sql`
    SELECT
      f.id, f.name,
      count(DISTINCT m.product_id) as product_count,
      count(DISTINCT m.colour) as colour_count,
      count(*) FILTER (WHERE m.type = 'optical') as optical_count,
      count(*) FILTER (WHERE m.type = 'sun') as sun_count,
      count(DISTINCT pm.square_catalog_id) as square_count,
      json_agg(DISTINCT jsonb_build_object(
        'id', p.shopify_product_id,
        'image', p.images->0->>'src',
        'title', p.title,
        'category', p.metafields->'custom'->>'product_category'
      )) FILTER (WHERE p.shopify_product_id IS NOT NULL) as products
    FROM product_families f
    LEFT JOIN product_family_members m ON m.family_id = f.id
    LEFT JOIN products_projection p ON p.shopify_product_id = m.product_id
    LEFT JOIN product_mappings pm ON (pm.shopify_product_id = m.product_id OR pm.family_id = f.id)
      AND pm.status IN ('confirmed', 'auto', 'manual', 'related')
    GROUP BY f.id, f.name
    ORDER BY f.name
  `);

  return jsonOk(rows.rows);
});
