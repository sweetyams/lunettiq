export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';

/** GET /api/crm/products/facets — distinct tags + product types for rule pickers */
export const GET = handler(async () => {
  await requireCrmAuth();
  const [tagRows, typeRows] = await Promise.all([
    db.execute(sql`SELECT DISTINCT unnest(tags) AS tag FROM products_projection WHERE tags IS NOT NULL ORDER BY 1`),
    db.execute(sql`SELECT DISTINCT product_type FROM products_projection WHERE product_type IS NOT NULL AND product_type != '' ORDER BY 1`),
  ]);
  return jsonOk({
    tags: (tagRows.rows as { tag: string }[]).map(r => r.tag),
    productTypes: (typeRows.rows as { product_type: string }[]).map(r => r.product_type),
  });
});
