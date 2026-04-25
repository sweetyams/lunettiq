export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { locations } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

// POST /api/crm/settings/locations/sync
// Actions: link (attach channel ID to existing location) or create (new location from channel)
export const POST = handler(async (request) => {
  await requireCrmAuth('org:settings:locations');
  const body = await request.json();
  const { action } = body;

  if (action === 'link') {
    // Link a channel location to an existing CRM location
    const { locationId, channel, channelLocationId } = body;
    if (!locationId || !channel || !channelLocationId) {
      return jsonError('locationId, channel, channelLocationId required', 400);
    }
    if (channel !== 'shopify' && channel !== 'square') {
      return jsonError('channel must be shopify or square', 400);
    }
    const field = channel === 'shopify' ? 'shopifyLocationId' : 'squareLocationId';
    const [row] = await db.update(locations)
      .set({ [field]: channelLocationId, syncedAt: new Date() })
      .where(eq(locations.id, locationId))
      .returning();
    if (!row) return jsonError('Location not found', 404);
    return jsonOk(row);
  }

  if (action === 'create') {
    // Create a new CRM location from a channel location
    const { name, channel, channelLocationId, address } = body;
    if (!name?.trim() || !channel || !channelLocationId) {
      return jsonError('name, channel, channelLocationId required', 400);
    }
    const id = `loc_${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const existing = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, id));
    if (existing.length) return jsonError('Location with this name already exists', 409);

    const field = channel === 'shopify' ? 'shopifyLocationId' : 'squareLocationId';
    const [row] = await db.insert(locations).values({
      id,
      name: name.trim(),
      [field]: channelLocationId,
      address: address ?? null,
      active: true,
      syncedAt: new Date(),
    }).returning();
    return jsonOk(row, 201);
  }

  return jsonError('action must be link or create', 400);
});
