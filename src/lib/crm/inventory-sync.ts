/**
 * Inventory sync — pull from Shopify, resolve to canonical levels, project back.
 */
import { db } from '@/lib/db';
import { locations, productVariantsProjection, productFamilyMembers, inventoryLevels } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { graphqlAdmin } from '@/lib/shopify/admin-graphql';
import { adjust, projectToChannels } from './inventory';

const INVENTORY_QUERY = `query($locationId: ID!, $cursor: String) {
  location(id: $locationId) {
    inventoryLevels(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        quantities(names: ["available", "committed", "on_hand"]) { name quantity }
        item { variant { id } }
      }
    }
  }
}`;

function stripGid(gid: string) { return gid.replace(/^gid:\/\/shopify\/\w+\//, ''); }

export async function syncFromShopify(): Promise<{ synced: number; locations: number }> {
  const locs = await db.select().from(locations).where(sql`shopify_location_id IS NOT NULL`);
  let totalSynced = 0;

  for (const loc of locs) {
    if (!loc.shopifyLocationId) continue;
    const locationGid = `gid://shopify/Location/${loc.shopifyLocationId}`;
    let cursor: string | null = null;

    while (true) {
      const result = await graphqlAdmin<any>(INVENTORY_QUERY, { locationId: locationGid, cursor });
      const data = result?.location?.inventoryLevels;
      if (!data?.nodes?.length) break;

      for (const node of data.nodes) {
        const variantGid = node.item?.variant?.id;
        if (!variantGid) continue;
        const variantId = stripGid(variantGid);

        const quantities: Record<string, number> = {};
        for (const q of node.quantities ?? []) quantities[q.name] = q.quantity;

        const onHand = quantities.on_hand ?? quantities.available ?? 0;
        const committed = quantities.committed ?? 0;

        // Resolve to family+colour
        const [variant] = await db.select({ productId: productVariantsProjection.shopifyProductId })
          .from(productVariantsProjection).where(eq(productVariantsProjection.shopifyVariantId, variantId));
        if (!variant?.productId) continue;

        const [member] = await db.select({ familyId: productFamilyMembers.familyId, colour: productFamilyMembers.colour })
          .from(productFamilyMembers).where(eq(productFamilyMembers.productId, variant.productId));

        const familyId = member?.familyId ?? null;
        const colour = member?.colour ?? null;

        // Upsert inventory level
        const where = familyId && colour
          ? and(eq(inventoryLevels.familyId, familyId), eq(inventoryLevels.colour, colour), eq(inventoryLevels.locationId, loc.id))
          : and(eq(inventoryLevels.variantId, variantId), eq(inventoryLevels.locationId, loc.id));

        const [existing] = await db.select().from(inventoryLevels).where(where);

        if (existing) {
          const securityStock = existing.securityStock ?? 0;
          await db.update(inventoryLevels).set({
            onHand, committed,
            available: Math.max(0, onHand - committed - securityStock),
            syncedAt: new Date(), updatedAt: new Date(),
          }).where(eq(inventoryLevels.id, existing.id));
        } else {
          await db.insert(inventoryLevels).values({
            familyId, colour, variantId: familyId ? null : variantId,
            locationId: loc.id, onHand, committed, securityStock: 0,
            available: Math.max(0, onHand - committed),
            syncedAt: new Date(),
          });
        }
        totalSynced++;
      }

      if (!data.pageInfo.hasNextPage) break;
      cursor = data.pageInfo.endCursor;
    }
  }

  return { synced: totalSynced, locations: locs.length };
}

/** Pull inventory from Square for all locations with squareLocationId */
export async function syncFromSquare(): Promise<{ synced: number; locations: number }> {
  const { isIntegrationEnabled } = await import('@/lib/crm/integrations');
  if (!await isIntegrationEnabled('square')) return { synced: 0, locations: 0 };

  const { getInventoryCounts } = await import('@/lib/square/client');
  const { productMappings } = await import('@/lib/db/schema');

  const locs = await db.select().from(locations).where(sql`square_location_id IS NOT NULL`);
  if (!locs.length) return { synced: 0, locations: 0 };

  // Get all Square mappings
  const mappings = await db.execute(sql`
    SELECT m.square_catalog_id, m.shopify_product_id FROM product_mappings m
    WHERE m.shopify_product_id IS NOT NULL AND m.status IN ('confirmed', 'auto', 'manual')
  `);
  const catalogIds = (mappings.rows as any[]).map(r => r.square_catalog_id).filter(Boolean);
  if (!catalogIds.length) return { synced: 0, locations: locs.length };

  const locationIds = locs.map(l => l.squareLocationId!);
  const counts = await getInventoryCounts(catalogIds, locationIds);

  let totalSynced = 0;
  for (const count of counts) {
    // Map Square catalog ID → Shopify product → family+colour
    const mapping = (mappings.rows as any[]).find(m => m.square_catalog_id === count.catalogObjectId);
    if (!mapping?.shopify_product_id) continue;

    const loc = locs.find(l => l.squareLocationId === count.locationId);
    if (!loc) continue;

    const [member] = await db.select({ familyId: productFamilyMembers.familyId, colour: productFamilyMembers.colour })
      .from(productFamilyMembers).where(eq(productFamilyMembers.productId, mapping.shopify_product_id));

    const familyId = member?.familyId ?? null;
    const colour = member?.colour ?? null;

    // Only update if we don't already have Shopify data for this frame+location
    // (Shopify is primary, Square is supplementary for locations without Shopify)
    const where = familyId && colour
      ? and(eq(inventoryLevels.familyId, familyId), eq(inventoryLevels.colour, colour), eq(inventoryLevels.locationId, loc.id))
      : and(eq(inventoryLevels.variantId, mapping.shopify_product_id), eq(inventoryLevels.locationId, loc.id));

    const [existing] = await db.select().from(inventoryLevels).where(where);
    if (!existing) {
      await db.insert(inventoryLevels).values({
        familyId, colour, variantId: familyId ? null : mapping.shopify_product_id,
        locationId: loc.id, onHand: count.quantity, committed: 0, securityStock: 0,
        available: count.quantity, syncedAt: new Date(),
      });
      totalSynced++;
    }
  }

  return { synced: totalSynced, locations: locs.length };
}
