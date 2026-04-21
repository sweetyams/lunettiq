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

  // Get all unique metafield keys with product counts (single query)
  const keyRows = await db.execute(sql`
    SELECT ns.key as ns, field.key as field, count(*) as cnt
    FROM products_projection p,
    LATERAL jsonb_each(p.metafields) AS ns(key, value),
    LATERAL jsonb_each_text(ns.value) AS field(key, value)
    WHERE p.metafields IS NOT NULL AND field.value IS NOT NULL AND field.value != ''
    GROUP BY ns.key, field.key
    ORDER BY ns.key, field.key
  `);
  const totalProducts = await db.execute(sql`SELECT count(*) as cnt FROM products_projection WHERE metafields IS NOT NULL`);
  const total = Number((totalProducts.rows[0] as any)?.cnt ?? 0);

  const available: string[] = [];
  const coverage: Record<string, number> = {};
  for (const row of keyRows.rows as any[]) {
    const key = `${row.ns}.${row.field}`;
    available.push(key);
    coverage[key] = Number(row.cnt);
  }

  return jsonOk({ visible, available, coverage, totalProducts: total });
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
