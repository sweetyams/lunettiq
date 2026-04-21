export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { ordersProjection, locations } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';
import { getKey } from '@/lib/crm/integration-keys';

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');

  const squareToken = await getKey('SQUARE_ACCESS_TOKEN');
  if (!squareToken) return jsonError('Square not configured', 500);

  const base = process.env.SQUARE_ENVIRONMENT === 'sandbox' ? 'https://connect.squareupsandbox.com/v2' : 'https://connect.squareup.com/v2';

  // Get location mapping
  const locs = await db.select().from(locations);
  const squareToLoc = new Map<string, string>();
  for (const l of locs) { if (l.squareLocationId) squareToLoc.set(l.squareLocationId, l.id); }

  if (squareToLoc.size === 0) return jsonError('No Square locations linked. Sync locations first.', 400);

  let totalUpdated = 0;

  for (const [sqLocId, crmLocId] of squareToLoc) {
    let cursor: string | undefined;
    let count = 0;
    do {
      const body: any = { location_ids: [sqLocId], limit: 500, query: { filter: { state_filter: { states: ['COMPLETED'] } }, sort: { sort_field: 'CREATED_AT', sort_order: 'DESC' } } };
      if (cursor) body.cursor = cursor;
      const res = await fetch(`${base}/orders/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${squareToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      const ids = (d.orders ?? []).map((o: any) => 'sq_' + o.id);
      if (ids.length) {
        const arrayLiteral = '{' + ids.map((id: string) => '"' + id + '"').join(',') + '}';
        await db.execute(sql`UPDATE orders_projection SET location_id = ${crmLocId} WHERE shopify_order_id = ANY(${arrayLiteral}::text[]) AND location_id IS NULL`);
        count += ids.length;
      }
      cursor = d.cursor;
    } while (cursor);
    totalUpdated += count;
  }

  return jsonOk({ message: `Backfilled ${totalUpdated} orders across ${squareToLoc.size} locations.` });
});
