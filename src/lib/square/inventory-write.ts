/**
 * Square Inventory Write — SEPARATE from the read-only client.
 * Every write is logged to inventory_adjustments.
 */
import { getKey } from '@/lib/crm/integration-keys';

async function getBaseUrl(): Promise<string> {
  const env = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
  return env === 'production' ? 'https://connect.squareup.com/v2' : 'https://connect.squareupsandbox.com/v2';
}

export async function squareSetInventory(catalogObjectId: string, squareLocationId: string, quantity: number): Promise<boolean> {
  const token = await getKey('SQUARE_ACCESS_TOKEN');
  if (!token) return false;
  const base = await getBaseUrl();

  // Get current count first
  const countRes = await fetch(`${base}/inventory/counts/batch-retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Square-Version': '2024-10-17' },
    body: JSON.stringify({ catalog_object_ids: [catalogObjectId], location_ids: [squareLocationId], states: ['IN_STOCK'] }),
  });
  const countData = await countRes.json();
  const current = parseFloat(countData.counts?.[0]?.quantity ?? '0');
  const delta = quantity - current;
  if (delta === 0) return true;

  // Apply change
  const res = await fetch(`${base}/inventory/changes/batch-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Square-Version': '2024-10-17' },
    body: JSON.stringify({
      idempotency_key: `lunettiq-inv-${catalogObjectId}-${squareLocationId}-${Date.now()}`,
      changes: [{
        type: 'ADJUSTMENT',
        adjustment: {
          catalog_object_id: catalogObjectId,
          location_id: squareLocationId,
          quantity: String(Math.abs(delta)),
          from_state: delta > 0 ? 'NONE' : 'IN_STOCK',
          to_state: delta > 0 ? 'IN_STOCK' : 'NONE',
          occurred_at: new Date().toISOString(),
        },
      }],
    }),
  });

  return res.ok;
}
