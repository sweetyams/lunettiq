export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { storeSettings } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';

const KEY = 'metafield_visible_fields';
const GROUPS_KEY = 'metafield_groups';
const DEFAULT_GROUPS = [
  { label: 'Sizing', keys: ['custom.lens_width', 'custom.bridge_width', 'custom.temple_length', 'custom.lens_height', 'custom.frame_width', 'custom.weight_grams'] },
  { label: 'Material', keys: ['custom.material_type', 'custom.material_description', 'custom.origin', 'custom.hinge_type'] },
  { label: 'Classification', keys: ['custom.shape', 'custom.frame_colour', 'custom.size_category', 'custom.gender_fit', 'custom.frame_type'] },
  { label: 'Editorial', keys: ['custom.designer_notes', 'custom.collection_season', 'custom.face_notes', 'custom.short_name', 'custom.swatch'] },
  { label: 'Rx', keys: ['custom.rx_compatible', 'custom.progressive_compatible', 'custom.max_lens_index', 'custom.supports_polarized'] },
];

// GET — return visible fields, groups, available fields with coverage
export const GET = handler(async () => {
  await requireCrmAuth();
  const [visRow, grpRow] = await Promise.all([
    db.select().from(storeSettings).where(eq(storeSettings.key, KEY)).then(r => r[0]),
    db.select().from(storeSettings).where(eq(storeSettings.key, GROUPS_KEY)).then(r => r[0]),
  ]);
  const visible = visRow ? JSON.parse(visRow.value) : [];
  const groups = grpRow ? JSON.parse(grpRow.value) : DEFAULT_GROUPS;

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

  return jsonOk({ visible, groups, available, coverage, totalProducts: total });
});

// POST — update visible fields and/or groups
export const POST = handler(async (request) => {
  await requireCrmAuth('org:settings:tags');
  const body = await request.json();

  if (body.visible) {
    await db.insert(storeSettings).values({ key: KEY, value: JSON.stringify(body.visible) })
      .onConflictDoUpdate({ target: storeSettings.key, set: { value: JSON.stringify(body.visible), updatedAt: new Date() } });
  }
  if (body.groups) {
    await db.insert(storeSettings).values({ key: GROUPS_KEY, value: JSON.stringify(body.groups) })
      .onConflictDoUpdate({ target: storeSettings.key, set: { value: JSON.stringify(body.groups), updatedAt: new Date() } });
  }

  return jsonOk({ ok: true });
});
