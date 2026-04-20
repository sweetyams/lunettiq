/**
 * Square Historical Backfill — READ-ONLY
 *
 * Pulls completed orders from Square and sends them through
 * the same Inngest sync pipeline as live webhooks.
 *
 * Usage:
 *   npx tsx scripts/backfill-square.ts
 *   npx tsx scripts/backfill-square.ts --from 2024-01-01 --to 2024-12-31
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SQUARE_BASE = process.env.SQUARE_ENVIRONMENT === 'production'
  ? 'https://connect.squareup.com/v2'
  : 'https://connect.squareupsandbox.com/v2';
const TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
const INNGEST_URL = process.env.INNGEST_EVENT_KEY
  ? 'https://inn.gs/e/' + process.env.INNGEST_EVENT_KEY
  : 'http://localhost:8288/e/test';

if (!TOKEN) { console.error('SQUARE_ACCESS_TOKEN not set'); process.exit(1); }

// Parse args
const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
const toIdx = args.indexOf('--to');
const fromDate = fromIdx >= 0 ? args[fromIdx + 1] : new Date(Date.now() - 365 * 86400000).toISOString();
const toDate = toIdx >= 0 ? args[toIdx + 1] : new Date().toISOString();

async function squareSearch(body: Record<string, unknown>) {
  const res = await fetch(`${SQUARE_BASE}/orders/search`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Square-Version': '2026-01-22', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Square ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getLocations(): Promise<string[]> {
  const res = await fetch(`${SQUARE_BASE}/locations`, {
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Square-Version': '2026-01-22' },
  });
  const data = await res.json();
  return (data.locations ?? []).map((l: any) => l.id);
}

async function sendToInngest(name: string, data: Record<string, unknown>) {
  await fetch(INNGEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  });
}

async function main() {
  console.log(`Square Backfill — READ-ONLY`);
  console.log(`Range: ${fromDate} → ${toDate}`);
  console.log(`Environment: ${process.env.SQUARE_ENVIRONMENT ?? 'sandbox'}`);
  console.log('');

  const locationIds = await getLocations();
  console.log(`Found ${locationIds.length} locations: ${locationIds.join(', ')}`);

  let cursor: string | undefined;
  let total = 0;

  do {
    const body: Record<string, unknown> = {
      location_ids: locationIds,
      limit: 50,
      return_entries: false,
      query: {
        filter: {
          date_time_filter: { created_at: { start_at: fromDate, end_at: toDate } },
          state_filter: { states: ['COMPLETED'] },
        },
        sort: { sort_field: 'CREATED_AT', sort_order: 'ASC' },
      },
    };
    if (cursor) body.cursor = cursor;

    const data = await squareSearch(body);
    const orders = data.orders ?? [];
    cursor = data.cursor;

    for (const order of orders) {
      await sendToInngest('square/order.synced', { order });
      total++;
      if (total % 10 === 0) console.log(`  Sent ${total} orders…`);
    }

    // Rate limit: 100ms between pages
    if (cursor) await new Promise(r => setTimeout(r, 100));
  } while (cursor);

  console.log(`\nDone — ${total} orders sent to Inngest for processing.`);
}

main().catch(e => { console.error(e); process.exit(1); });
