export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { storeSettings } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';

const KEY = 'metafield_visible_fields';
const DEFAULT_VISIBLE = ['custom.short_name', 'custom.composition', 'custom.sizing_dimensions', 'custom.face_shapes', 'custom.season', 'custom.swatch', 'custom.short_description', 'custom.staff_pick', 'custom.featured', 'custom.latest', 'custom.alter_ego'];

// GET — return visible fields list + all available fields
export const GET = handler(async () => {
  await requireCrmAuth();
  const row = await db.select().from(storeSettings).where(eq(storeSettings.key, KEY)).then(r => r[0]);
  const visible = row ? JSON.parse(row.value) : DEFAULT_VISIBLE;

  // Get all unique metafield keys across products
  const allKeys = await db.execute(sql`
    SELECT DISTINCT ns.key as ns, field.key as field
    FROM products_projection p,
    LATERAL jsonb_each(p.metafields) AS ns(key, value),
    LATERAL jsonb_each_text(ns.value) AS field(key, value)
    WHERE p.metafields IS NOT NULL
    LIMIT 200
  `).then(r => r.rows.map((row: any) => `${row.ns}.${row.field}`));

  return jsonOk({ visible, available: allKeys });
});

// POST — update visible fields
export const POST = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const { visible } = await request.json();
  if (!Array.isArray(visible)) return jsonError('visible must be an array', 400);

  await db.insert(storeSettings).values({ key: KEY, value: JSON.stringify(visible) })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: JSON.stringify(visible), updatedAt: new Date() } });

  return jsonOk({ visible });
});
