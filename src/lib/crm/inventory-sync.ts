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

export async function syncFromShopify(): Promise<{ synced: number; locations: number; errors: string[] }> {
  const locs = await db.select().from(locations).where(sql`shopify_location_id IS NOT NULL`);
  let totalSynced = 0;
  const errors: string[] = [];
  const startTime = Date.now();
  const TIMEOUT_MS = 100_000; // 100s safety margin (Vercel limit is 120s)

  console.log('[inventory-sync] Starting Shopify sync, locations:', locs.map(l => ({ id: l.id, name: l.name, shopifyId: l.shopifyLocationId })));

  for (const loc of locs) {
    if (!loc.shopifyLocationId) continue;
    if (Date.now() - startTime > TIMEOUT_MS) { errors.push(`Timeout after ${Math.round((Date.now() - startTime) / 1000)}s — stopped at location ${loc.name}`); break; }

    const locationGid = `gid://shopify/Location/${loc.shopifyLocationId}`;
    let cursor: string | null = null;
    let pages = 0;
    console.log('[inventory-sync] Fetching location:', loc.name, locationGid);

    while (true) {
      if (Date.now() - startTime > TIMEOUT_MS) { errors.push(`Timeout during ${loc.name} page ${pages}`); break; }
      pages++;

      let result;
      try {
        result = await graphqlAdmin<any>(INVENTORY_QUERY, { locationId: locationGid, cursor });
      } catch (e) { errors.push(`${loc.name}: fetch error — ${(e as Error).message}`); break; }

      console.log('[inventory-sync]', loc.name, 'page', pages, 'ok:', result.ok, 'error:', result.error ?? 'none', 'nodes:', result.data?.location?.inventoryLevels?.nodes?.length ?? 0);

      if (!result.ok) { errors.push(`${loc.name}: ${result.error}`); break; }
      const data = result.data?.location?.inventoryLevels;
      if (!data?.nodes?.length) { if (pages === 1) errors.push(`${loc.name}: 0 inventory levels returned — check read_inventory scope`); break; }

      for (const node of data.nodes) {
        const variantGid = node.item?.variant?.id;
        if (!variantGid) { console.log('[inventory-sync] Skipping node with no variant:', JSON.stringify(node).slice(0, 200)); continue; }
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

  // Reconcile orphan variant-level rows into family+colour rows
  const reconciled = await reconcileOrphanLevels();
  if (reconciled.merged || reconciled.deleted) {
    console.log('[inventory-sync] Reconciled orphans:', reconciled);
  }

  return { synced: totalSynced, locations: locs.length, errors };
}

/**
 * Reconcile orphan variant-level inventory rows.
 * When a variant now belongs to a family+colour, merge its inventory into the family row and delete the orphan.
 */
export async function reconcileOrphanLevels(): Promise<{ merged: number; deleted: number }> {
  const orphans = await db.select().from(inventoryLevels)
    .where(and(sql`${inventoryLevels.familyId} IS NULL`, sql`${inventoryLevels.variantId} IS NOT NULL`));
  if (!orphans.length) return { merged: 0, deleted: 0 };

  // Batch-resolve variants → products → family+colour
  const variantIds = orphans.map(o => o.variantId!);
  const variants = await db.select({ variantId: productVariantsProjection.shopifyVariantId, productId: productVariantsProjection.shopifyProductId })
    .from(productVariantsProjection)
    .where(sql`${productVariantsProjection.shopifyVariantId} IN (${sql.join(variantIds.map(id => sql`${id}`), sql`, `)})`);
  const variantToProduct = new Map(variants.map(v => [v.variantId, v.productId]));

  const productIds = [...new Set(variants.map(v => v.productId))];
  const memberships = productIds.length ? await db.select()
    .from(productFamilyMembers)
    .where(sql`${productFamilyMembers.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`) : [];
  const productToFamily = new Map(memberships.filter(m => m.familyId && m.colour).map(m => [m.productId, { familyId: m.familyId, colour: m.colour! }]));

  let merged = 0, deleted = 0;
  for (const orphan of orphans) {
    const productId = variantToProduct.get(orphan.variantId!);
    if (!productId) continue;
    const family = productToFamily.get(productId);
    if (!family) continue;

    const [existing] = await db.select().from(inventoryLevels)
      .where(and(eq(inventoryLevels.familyId, family.familyId), eq(inventoryLevels.colour, family.colour), eq(inventoryLevels.locationId, orphan.locationId)));

    if (existing) {
      // Merge orphan stock into canonical row
      if ((orphan.onHand ?? 0) > 0) {
        const newOnHand = (existing.onHand ?? 0) + (orphan.onHand ?? 0);
        await db.update(inventoryLevels).set({
          onHand: newOnHand,
          available: Math.max(0, newOnHand - (existing.committed ?? 0) - (existing.securityStock ?? 0)),
          updatedAt: new Date(),
        }).where(eq(inventoryLevels.id, existing.id));
        merged++;
      }
      await db.delete(inventoryLevels).where(eq(inventoryLevels.id, orphan.id));
      deleted++;
    } else {
      // Convert orphan in-place to family-level row
      await db.update(inventoryLevels).set({
        familyId: family.familyId, colour: family.colour, variantId: null, updatedAt: new Date(),
      }).where(eq(inventoryLevels.id, orphan.id));
      merged++;
    }
  }
  return { merged, deleted };
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
