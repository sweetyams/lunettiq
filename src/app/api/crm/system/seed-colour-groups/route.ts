export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { colourGroups } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';

const DEFAULTS = [
  { id: 'black', label: 'Black', members: ['black'], sortOrder: 1 },
  { id: 'brown', label: 'Brown', members: ['brown-2', 'bronze', 'tortoise'], sortOrder: 2 },
  { id: 'blue', label: 'Blue', members: ['blue', 'marble-blue', 'dark-blue'], sortOrder: 3 },
  { id: 'green', label: 'Green', members: ['green'], sortOrder: 4 },
  { id: 'grey', label: 'Grey', members: ['grey', 'silver'], sortOrder: 5 },
  { id: 'gold', label: 'Gold', members: ['gold', 'champagne', 'rose-gold'], sortOrder: 6 },
  { id: 'red', label: 'Red', members: ['red', 'burgundy', 'bordeau'], sortOrder: 7 },
  { id: 'orange', label: 'Orange', members: ['orange-2', 'orange-fade'], sortOrder: 8 },
  { id: 'pink', label: 'Pink', members: ['pink'], sortOrder: 9 },
  { id: 'purple', label: 'Purple', members: ['purple-2'], sortOrder: 10 },
  { id: 'clear', label: 'Clear', members: ['clear'], sortOrder: 11 },
  { id: 'two-tone', label: 'Two-Tone', members: ['2-tone'], sortOrder: 12 },
];

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:tags');

  const existing = await db.execute(sql`SELECT count(*) as c FROM colour_groups`);
  if (Number(existing.rows[0]?.c) > 0) {
    return jsonOk({ message: `Skipped — ${existing.rows[0].c} groups already exist. Delete them first to re-seed.` });
  }

  for (const g of DEFAULTS) {
    await db.insert(colourGroups).values(g).onConflictDoNothing();
  }

  return jsonOk({ message: `Seeded ${DEFAULTS.length} default colour groups.` });
});
