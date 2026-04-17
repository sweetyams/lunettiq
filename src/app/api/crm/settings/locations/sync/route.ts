export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:locations');

  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  if (!token || !domain) return jsonError('Shopify not configured', 500);

  const res = await fetch(`https://${domain}/admin/api/2024-04/locations.json`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  if (!res.ok) return jsonError('Failed to fetch Shopify locations', 502);

  const data = await res.json();
  const shopifyLocations = data.locations ?? [];

  const rows = shopifyLocations.map((loc: any) => ({
    id: `loc_${loc.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    shopifyLocationId: String(loc.id),
    name: loc.name,
    address: { address1: loc.address1, city: loc.city, province: loc.province, country: loc.country, zip: loc.zip },
    active: loc.active,
    syncedAt: new Date(),
  }));

  for (const row of rows) {
    await db.insert(locations).values(row).onConflictDoUpdate({
      target: locations.id,
      set: { name: row.name, shopifyLocationId: row.shopifyLocationId, address: row.address, active: row.active, syncedAt: row.syncedAt },
    });
  }

  return jsonOk({ synced: rows.length, locations: rows });
});
