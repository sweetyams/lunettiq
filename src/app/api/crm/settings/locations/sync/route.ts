export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { getKey } from '@/lib/crm/integration-keys';
import { eq } from 'drizzle-orm';

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:locations');

  const token = await getKey('SHOPIFY_ADMIN_API_ACCESS_TOKEN');
  const domain = await getKey('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN');
  if (!token || !domain) return jsonError('Shopify not configured', 500);

  // Fetch Shopify locations
  const res = await fetch(`https://${domain}/admin/api/2024-04/locations.json`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  if (!res.ok) return jsonError('Failed to fetch Shopify locations', 502);

  const data = await res.json();
  const shopifyLocations = data.locations ?? [];

  // Fetch Square locations (if configured)
  let squareLocations: Array<{ id: string; name: string; address?: any }> = [];
  const squareToken = await getKey('SQUARE_ACCESS_TOKEN');
  if (squareToken) {
    try {
      const { listLocations } = await import('@/lib/square/client');
      squareLocations = await listLocations();
    } catch {}
  }

  // Upsert Shopify locations
  const rows = shopifyLocations.map((loc: any) => {
    const id = `loc_${loc.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const locName = loc.name.toLowerCase();

    // Match Square location by name similarity
    const squareMatch = squareLocations.find(sq =>
      sq.name.toLowerCase().includes(locName) || locName.includes(sq.name.toLowerCase())
    );

    return {
      id,
      shopifyLocationId: String(loc.id),
      squareLocationId: squareMatch?.id ?? null,
      name: loc.name,
      address: { address1: loc.address1, city: loc.city, province: loc.province, country: loc.country, zip: loc.zip },
      active: loc.active,
      syncedAt: new Date(),
    };
  });

  for (const row of rows) {
    await db.insert(locations).values(row).onConflictDoUpdate({
      target: locations.id,
      set: {
        name: row.name,
        shopifyLocationId: row.shopifyLocationId,
        squareLocationId: row.squareLocationId,
        address: row.address,
        active: row.active,
        syncedAt: row.syncedAt,
      },
    });
  }

  // Handle Square locations that don't match any Shopify location
  const matchedSquareIds = new Set(rows.map(r => r.squareLocationId).filter(Boolean));
  const unmatchedSquare = squareLocations.filter(sq => !matchedSquareIds.has(sq.id));

  for (const sq of unmatchedSquare) {
    const id = `loc_${sq.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    await db.insert(locations).values({
      id,
      squareLocationId: sq.id,
      name: sq.name,
      address: sq.address ?? null,
      active: true,
      syncedAt: new Date(),
    }).onConflictDoUpdate({
      target: locations.id,
      set: { squareLocationId: sq.id, syncedAt: new Date() },
    });
  }

  return jsonOk({ synced: rows.length, squareMatched: rows.filter(r => r.squareLocationId).length, squareUnmatched: unmatchedSquare.length });
});
