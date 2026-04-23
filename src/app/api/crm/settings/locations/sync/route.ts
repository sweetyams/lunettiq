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

  // Fetch existing locations to preserve manual edits
  const existing = await db.select().from(locations);
  const existingById = new Map(existing.map(l => [l.id, l]));
  const existingByShopifyId = new Map(existing.filter(l => l.shopifyLocationId).map(l => [l.shopifyLocationId!, l]));
  const existingBySquareId = new Map(existing.filter(l => l.squareLocationId).map(l => [l.squareLocationId!, l]));

  // Track which Shopify/Square IDs are still present in source
  const activeShopifyIds = new Set<string>();
  const activeSquareIds = new Set<string>();

  // Upsert Shopify locations — only insert new, preserve existing edits
  for (const loc of shopifyLocations) {
    const shopifyId = String(loc.id);
    activeShopifyIds.add(shopifyId);
    const address = { address1: loc.address1, city: loc.city, province: loc.province, country: loc.country, zip: loc.zip };

    // Check if already linked by shopifyLocationId
    const linked = existingByShopifyId.get(shopifyId);
    if (linked) {
      // Only update address + syncedAt, preserve name and connections
      await db.update(locations).set({ address, syncedAt: new Date() }).where(eq(locations.id, linked.id));
      continue;
    }

    // New location — insert
    const id = `loc_${loc.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    await db.insert(locations).values({
      id,
      shopifyLocationId: shopifyId,
      name: loc.name,
      address,
      active: loc.active,
      syncedAt: new Date(),
    }).onConflictDoUpdate({
      target: locations.id,
      // If id exists but no shopifyLocationId, link it
      set: { shopifyLocationId: shopifyId, address, syncedAt: new Date() },
    });
  }

  // Upsert Square locations — only insert new, preserve existing edits
  for (const sq of squareLocations) {
    activeSquareIds.add(sq.id);
    const linked = existingBySquareId.get(sq.id);
    if (linked) {
      // Already linked, just update syncedAt
      await db.update(locations).set({ syncedAt: new Date() }).where(eq(locations.id, linked.id));
      continue;
    }

    // New Square location — insert
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

  return jsonOk({ synced: shopifyLocations.length, squareTotal: squareLocations.length });
});
