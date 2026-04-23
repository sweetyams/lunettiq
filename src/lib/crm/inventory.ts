/**
 * Inventory service — core logic for stock management.
 * Inventory truth lives here. Shopify/Square are projections.
 */
import { db } from '@/lib/db';
import { inventoryLevels, inventoryAdjustments, productFamilyMembers, productVariantsProjection, locations } from '@/lib/db/schema';
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

  await db.update(inventoryLevels).set(updates).where(eq(inventoryLevels.id, level.id));

  // Audit log
  await db.insert(inventoryAdjustments).values({
    familyId: familyId ?? null, colour: colour ?? null, variantId: variantId ?? null,
    locationId, quantityChange: delta, field, reason,
    referenceId: referenceId ?? null, referenceType: referenceType ?? null,
    staffId: staffId ?? null, note: note ?? null,
    previousValue, newValue,
  });

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

// ── Project to channels ──────────────────────────────────

export async function projectToChannels(familyId: string | null, colour: string | null, variantId: string | null) {
  if (!familyId || !colour) {
    // Variant-level fallback — just update the single variant in Shopify
    if (variantId) {
      const levels = await getLevels({ variantId });
      const total = levels.reduce((sum, l) => sum + l.available, 0);
      // TODO: push to Shopify via Admin API
      // TODO: push to Square via inventory write
      await db.update(productVariantsProjection)
        .set({ inventoryQuantity: total, availableForSale: total > 0 })
        .where(eq(productVariantsProjection.shopifyVariantId, variantId));
    }
    return;
  }

  // Get all levels for this frame
  const levels = await getLevels({ familyId, colour });
  const totalAvailable = levels.reduce((sum, l) => sum + l.available, 0);

  // Get shipping location for online availability
  const { getSettings } = await import('@/lib/crm/store-settings');
  const settings = await getSettings();
  const shippingLocationId = settings.shipping_location_id ?? null;
  const onlineAvailable = shippingLocationId
    ? levels.find(l => l.locationId === shippingLocationId)?.available ?? 0
    : totalAvailable;

  // Find all Shopify variants for this family+colour
  const members = await db.select({ productId: productFamilyMembers.productId })
    .from(productFamilyMembers)
    .where(and(eq(productFamilyMembers.familyId, familyId), eq(productFamilyMembers.colour, colour)));

  if (members.length) {
    const productIds = members.map(m => m.productId);
    const variants = await db.select()
      .from(productVariantsProjection)
      .where(inArray(productVariantsProjection.shopifyProductId, productIds));

    // Update local projection
    for (const v of variants) {
      await db.update(productVariantsProjection)
        .set({ inventoryQuantity: onlineAvailable, availableForSale: onlineAvailable > 0 })
        .where(eq(productVariantsProjection.shopifyVariantId, v.shopifyVariantId));
    }

    // TODO: Push to Shopify Admin API (inventorySetQuantities)
    // TODO: Push to Square Inventory API (batch change)
  }
}
