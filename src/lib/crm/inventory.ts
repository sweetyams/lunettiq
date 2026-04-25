/**
 * Inventory service — core logic for stock management.
 * Inventory truth lives here. Shopify/Square are projections.
 */
import { db } from '@/lib/db';
import { inventoryLevels, inventoryAdjustments, productFamilyMembers, productVariantsProjection, locations, inventoryProtections } from '@/lib/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

// ── Types ────────────────────────────────────────────────

export interface InventoryLevel {
  id: string;
  familyId: string | null;
  colour: string | null;
  variantId: string | null;
  locationId: string;
  locationName?: string;
  onHand: number;
  committed: number;
  securityStock: number;
  available: number;
  discontinued: boolean;
}

type AdjustReason = 'sale' | 'return' | 'recount' | 'damage' | 'loss' | 'transfer' | 'received' | 'manual' | 'sync';

// ── Resolve family+colour from variant ───────────────────

export async function resolveFrame(variantId: string): Promise<{ familyId: string | null; colour: string | null; variantId: string }> {
  // Get the product ID for this variant
  const [variant] = await db.select({ productId: productVariantsProjection.shopifyProductId })
    .from(productVariantsProjection)
    .where(eq(productVariantsProjection.shopifyVariantId, variantId));
  if (!variant?.productId) return { familyId: null, colour: null, variantId };

  // Check if product is in a family
  const [member] = await db.select({ familyId: productFamilyMembers.familyId, colour: productFamilyMembers.colour })
    .from(productFamilyMembers)
    .where(eq(productFamilyMembers.productId, variant.productId));

  if (member?.familyId && member?.colour) {
    return { familyId: member.familyId, colour: member.colour, variantId };
  }
  return { familyId: null, colour: null, variantId };
}

// ── Get levels ───────────────────────────────────────────

export async function getLevels(opts: { familyId?: string; colour?: string; variantId?: string; locationId?: string; productId?: string }): Promise<InventoryLevel[]> {
  const conditions = [];

  if (opts.productId) {
    // Resolve via family membership
    const members = await db.select({ familyId: productFamilyMembers.familyId, colour: productFamilyMembers.colour })
      .from(productFamilyMembers).where(eq(productFamilyMembers.productId, opts.productId));
    if (members.length && members[0].familyId && members[0].colour) {
      conditions.push(eq(inventoryLevels.familyId, members[0].familyId));
      conditions.push(eq(inventoryLevels.colour, members[0].colour));
    } else {
      // Fallback: variant-level
      const variants = await db.select({ id: productVariantsProjection.shopifyVariantId })
        .from(productVariantsProjection).where(eq(productVariantsProjection.shopifyProductId, opts.productId));
      if (variants.length) {
        conditions.push(inArray(inventoryLevels.variantId, variants.map(v => v.id)));
      }
    }
  } else {
    if (opts.familyId) conditions.push(eq(inventoryLevels.familyId, opts.familyId));
    if (opts.colour) conditions.push(eq(inventoryLevels.colour, opts.colour));
    if (opts.variantId) conditions.push(eq(inventoryLevels.variantId, opts.variantId));
  }
  if (opts.locationId) conditions.push(eq(inventoryLevels.locationId, opts.locationId));

  const rows = await db.select().from(inventoryLevels)
    .where(conditions.length ? and(...conditions) : undefined);

  // Attach location names
  const locs = await db.select().from(locations);
  const locMap = new Map(locs.map(l => [l.id, l.name]));

  return rows.map(r => ({
    id: r.id,
    familyId: r.familyId,
    colour: r.colour,
    variantId: r.variantId,
    locationId: r.locationId,
    locationName: locMap.get(r.locationId) ?? r.locationId,
    onHand: r.onHand ?? 0,
    committed: r.committed ?? 0,
    securityStock: r.securityStock ?? 0,
    available: r.available ?? 0,
    discontinued: r.discontinued ?? false,
  }));
}

// ── Adjust ───────────────────────────────────────────────

function recalcAvailable(onHand: number, committed: number, securityStock: number): number {
  return Math.max(0, onHand - committed - securityStock);
}

export async function adjust(opts: {
  familyId?: string | null; colour?: string | null; variantId?: string | null;
  locationId: string; field: 'on_hand' | 'committed' | 'security_stock';
  delta: number; reason: AdjustReason;
  referenceId?: string; referenceType?: string; staffId?: string; note?: string;
}): Promise<InventoryLevel> {
  const { familyId, colour, variantId, locationId, field, delta, reason, referenceId, referenceType, staffId, note } = opts;

  // Find or create the level
  let [level] = await db.select().from(inventoryLevels).where(
    familyId && colour
      ? and(eq(inventoryLevels.familyId, familyId), eq(inventoryLevels.colour, colour), eq(inventoryLevels.locationId, locationId))
      : and(eq(inventoryLevels.variantId, variantId!), eq(inventoryLevels.locationId, locationId))
  );

  if (!level) {
    [level] = await db.insert(inventoryLevels).values({
      familyId: familyId ?? null, colour: colour ?? null, variantId: variantId ?? null,
      locationId, onHand: 0, committed: 0, securityStock: 0, available: 0,
    }).returning();
  }

  const fieldMap = { on_hand: 'onHand', committed: 'committed', security_stock: 'securityStock' } as const;
  const dbField = fieldMap[field];
  const previousValue = (level as any)[dbField] ?? 0;
  const newValue = previousValue + delta;

  const updates: Record<string, unknown> = { [dbField]: newValue, updatedAt: new Date() };
  const onHand = field === 'on_hand' ? newValue : (level.onHand ?? 0);
  const committed = field === 'committed' ? newValue : (level.committed ?? 0);
  const securityStock = field === 'security_stock' ? newValue : (level.securityStock ?? 0);
  updates.available = recalcAvailable(onHand, committed, securityStock);

  // Auto-sold-out: if available hits 0 and discontinueAtZero is true
  const newAvailable = updates.available as number;
  if (newAvailable <= 0 && level.discontinueAtZero !== false) {
    updates.lifecycle = 'sold_out';
  } else if (newAvailable > 0 && (level as any).lifecycle === 'sold_out') {
    updates.lifecycle = newAvailable <= (level.lowStockThreshold ?? 5) ? 'low_stock' : 'active';
  }

  await db.update(inventoryLevels).set(updates).where(eq(inventoryLevels.id, level.id));

  // Audit log
  await db.insert(inventoryAdjustments).values({
    familyId: familyId ?? null, colour: colour ?? null, variantId: variantId ?? null,
    locationId, quantityChange: delta, field, reason,
    referenceId: referenceId ?? null, referenceType: referenceType ?? null,
    staffId: staffId ?? null, note: note ?? null,
    previousValue, newValue,
  });

  // Last-unit lock: auto-create protection when total available across all locations drops to 1
  if (familyId && colour && delta < 0) {
    const { productFamilies } = await import('@/lib/db/schema');
    const [family] = await db.select().from(productFamilies).where(eq(productFamilies.id, familyId));
    if (family?.lastUnitProtected) {
      const allLevels = await getLevels({ familyId, colour });
      const totalAvail = allLevels.reduce((s, l) => s + l.available, 0);
      if (totalAvail <= 1 && totalAvail > 0) {
        // Check no existing active last_unit_lock for this frame
        const existing = await listProtections({ familyId, colour, activeOnly: true });
        if (!existing.some(p => p.reason === 'last_unit_lock')) {
          const lastLoc = allLevels.find(l => l.available > 0);
          if (lastLoc) {
            await db.insert(inventoryProtections).values({
              familyId, colour, locationId: lastLoc.locationId,
              quantity: 1, scope: 'all_channels', reason: 'last_unit_lock',
              note: 'Auto-created: last unit protection',
            });
          }
        }
      }
    }
  }

  return { ...level, [dbField]: newValue, available: recalcAvailable(onHand, committed, securityStock) } as any;
}

// ── Set absolute (recount) ───────────────────────────────

export async function recount(opts: {
  familyId?: string | null; colour?: string | null; variantId?: string | null;
  locationId: string; newOnHand: number; staffId?: string; note?: string;
}): Promise<InventoryLevel> {
  const levels = await getLevels({
    familyId: opts.familyId ?? undefined,
    colour: opts.colour ?? undefined,
    variantId: opts.variantId ?? undefined,
    locationId: opts.locationId,
  });
  const current = levels[0]?.onHand ?? 0;
  const delta = opts.newOnHand - current;
  return adjust({
    ...opts, field: 'on_hand', delta, reason: 'recount',
  });
}

// ── Compute active protections for a frame+location ──────

export async function getActiveProtections(familyId: string, colour: string, locationId?: string): Promise<{ total: number; onlineOnly: number; squareOnly: number }> {
  const { inventoryProtections } = await import('@/lib/db/schema');
  const conditions = [
    eq(inventoryProtections.familyId, familyId),
    eq(inventoryProtections.colour, colour),
    sql`${inventoryProtections.releasedAt} IS NULL`,
    sql`(${inventoryProtections.expiresAt} IS NULL OR ${inventoryProtections.expiresAt} > NOW())`,
  ];
  if (locationId) conditions.push(eq(inventoryProtections.locationId, locationId));

  const rows = await db.select().from(inventoryProtections).where(and(...conditions));
  let total = 0, onlineOnly = 0, squareOnly = 0;
  for (const r of rows) {
    if (r.scope === 'all_channels') total += r.quantity;
    else if (r.scope === 'online_only') onlineOnly += r.quantity;
    else if (r.scope === 'square_only') squareOnly += r.quantity;
  }
  return { total, onlineOnly, squareOnly };
}

// ── Project to channels ──────────────────────────────────

export async function projectToChannels(familyId: string | null, colour: string | null, variantId: string | null) {
  if (!familyId || !colour) {
    // Variant-level fallback — just update the single variant in Shopify
    if (variantId) {
      const levels = await getLevels({ variantId });
      const total = levels.reduce((sum, l) => sum + l.available, 0);
      await db.update(productVariantsProjection)
        .set({ inventoryQuantity: total, availableForSale: total > 0 })
        .where(eq(productVariantsProjection.shopifyVariantId, variantId));
      try {
        const { shopifySetInventory } = await import('@/lib/shopify/admin-graphql');
        for (const l of levels) {
          const [loc] = await db.select().from(locations).where(eq(locations.id, l.locationId));
          if (loc?.shopifyLocationId) await shopifySetInventory(variantId, loc.shopifyLocationId, l.available);
        }
      } catch (e) { console.error('[inventory] Shopify push failed:', e); }
    }
    return;
  }

  // Get all levels + locations + protections for this frame
  const levels = await getLevels({ familyId, colour });
  const allLocs = await db.select().from(locations);
  const locMap = new Map(allLocs.map(l => [l.id, l]));
  const protections = await getActiveProtections(familyId, colour);

  // Multi-location Shopify projection: sum post-buffer available across fulfilling locations
  // Each location subtracts its own online_reserve_buffer before contributing
  let onlineAvailable = 0;
  for (const level of levels) {
    const loc = locMap.get(level.locationId);
    if (!loc?.fulfillsOnline) continue;
    const buffer = loc.onlineReserveBuffer ?? 2;
    const locAvail = Math.max(0, level.available - buffer);
    onlineAvailable += locAvail;
  }
  // Subtract online-scoped protections from the aggregate
  onlineAvailable = Math.max(0, onlineAvailable - protections.total - protections.onlineOnly);

  // Find all Shopify variants for this family+colour
  const members = await db.select({ productId: productFamilyMembers.productId })
    .from(productFamilyMembers)
    .where(and(eq(productFamilyMembers.familyId, familyId), eq(productFamilyMembers.colour, colour)));

  if (members.length) {
    const productIds = members.map(m => m.productId);
    const variants = await db.select()
      .from(productVariantsProjection)
      .where(inArray(productVariantsProjection.shopifyProductId, productIds));

    const safeOnline = Math.max(0, onlineAvailable);
    for (const v of variants) {
      await db.update(productVariantsProjection)
        .set({ inventoryQuantity: safeOnline, availableForSale: safeOnline > 0 })
        .where(eq(productVariantsProjection.shopifyVariantId, v.shopifyVariantId));
    }

    // Push to Shopify — use default fulfillment location (or first fulfilling location)
    try {
      const { shopifySetInventory } = await import('@/lib/shopify/admin-graphql');
      const { getSettings } = await import('@/lib/crm/store-settings');
      const settings = await getSettings();
      const primaryLocId = settings.default_fulfillment_location ?? settings.shipping_location_id;
      const primaryLoc = primaryLocId ? allLocs.find(l => l.id === primaryLocId) : allLocs.find(l => l.fulfillsOnline);
      if (primaryLoc?.shopifyLocationId) {
        for (const v of variants) {
          await shopifySetInventory(v.shopifyVariantId, primaryLoc.shopifyLocationId, safeOnline);
        }
      }
    } catch (e) { console.error('[inventory] Shopify push failed:', e); }

    // Push to Square — each location gets its own available minus protections
    try {
      const { squareSetInventory } = await import('@/lib/square/inventory-write');
      const mappings = await db.execute(sql`
        SELECT square_catalog_id, shopify_product_id FROM product_mappings
        WHERE shopify_product_id IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})
        AND status IN ('confirmed', 'auto', 'manual')
      `);
      for (const mapping of mappings.rows as any[]) {
        for (const level of levels) {
          const loc = locMap.get(level.locationId);
          if (loc?.squareLocationId && mapping.square_catalog_id) {
            const locProtections = await getActiveProtections(familyId, colour, level.locationId);
            const squareAvail = Math.max(0, level.available - locProtections.total - locProtections.squareOnly);
            await squareSetInventory(mapping.square_catalog_id, loc.squareLocationId, squareAvail);
          }
        }
      }
    } catch (e) { console.error('[inventory] Square push failed:', e); }
  }
}

// ── Protections CRUD ─────────────────────────────────────

type ProtectionScope = 'all_channels' | 'online_only' | 'square_only';
type ProtectionReason = 'display' | 'try_on_hold' | 'rx_in_progress' | 'transfer_pending' | 'last_unit_lock' | 'damage_review' | 'manager_hold';

export async function createProtection(opts: {
  familyId: string; colour: string; locationId: string;
  quantity?: number; scope?: ProtectionScope; reason: ProtectionReason;
  referenceId?: string; referenceType?: string;
  expiresAt?: Date; staffId?: string; note?: string;
}) {
  const [row] = await db.insert(inventoryProtections).values({
    familyId: opts.familyId, colour: opts.colour, locationId: opts.locationId,
    quantity: opts.quantity ?? 1, scope: opts.scope ?? 'all_channels', reason: opts.reason,
    referenceId: opts.referenceId ?? null, referenceType: opts.referenceType ?? null,
    expiresAt: opts.expiresAt ?? null, staffId: opts.staffId ?? null, note: opts.note ?? null,
  }).returning();
  // Re-project after protection change
  await projectToChannels(opts.familyId, opts.colour, null);
  return row;
}

export async function releaseProtection(protectionId: string) {
  const [row] = await db.update(inventoryProtections)
    .set({ releasedAt: new Date() })
    .where(and(eq(inventoryProtections.id, protectionId), sql`${inventoryProtections.releasedAt} IS NULL`))
    .returning();
  if (row) await projectToChannels(row.familyId, row.colour, null);
  return row;
}

export async function listProtections(opts?: { familyId?: string; colour?: string; locationId?: string; activeOnly?: boolean }) {
  const conditions = [];
  if (opts?.familyId) conditions.push(eq(inventoryProtections.familyId, opts.familyId));
  if (opts?.colour) conditions.push(eq(inventoryProtections.colour, opts.colour));
  if (opts?.locationId) conditions.push(eq(inventoryProtections.locationId, opts.locationId));
  if (opts?.activeOnly !== false) {
    conditions.push(sql`${inventoryProtections.releasedAt} IS NULL`);
    conditions.push(sql`(${inventoryProtections.expiresAt} IS NULL OR ${inventoryProtections.expiresAt} > NOW())`);
  }
  return db.select().from(inventoryProtections).where(conditions.length ? and(...conditions) : undefined);
}

export async function expireProtections(): Promise<number> {
  const expired = await db.select().from(inventoryProtections).where(and(
    sql`${inventoryProtections.releasedAt} IS NULL`,
    sql`${inventoryProtections.expiresAt} IS NOT NULL`,
    sql`${inventoryProtections.expiresAt} <= NOW()`,
  ));
  if (!expired.length) return 0;
  const ids = expired.map(r => r.id);
  await db.update(inventoryProtections)
    .set({ releasedAt: new Date() })
    .where(inArray(inventoryProtections.id, ids));
  // Re-project affected frames
  const frames = new Set(expired.map(r => `${r.familyId}|${r.colour}`));
  for (const key of frames) {
    const [fId, col] = key.split('|');
    await projectToChannels(fId, col, null);
  }
  return expired.length;
}