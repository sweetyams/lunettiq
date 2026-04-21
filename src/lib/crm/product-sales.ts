/**
 * Centralized product sales service.
 * Single source of truth for sales data across product detail, family, and list views.
 * Works with and without Square connection.
 */
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// ─── Types ───────────────────────────────────────────────

export interface SalesResult {
  units: number;
  orders: number;
  revenue: number;
}

export interface ChannelSales extends SalesResult {
  source: string;
}

export interface LocationSales extends SalesResult {
  locationId: string;
}

export interface ProductSalesResult {
  productId: string;
  direct: SalesResult;
  square: SalesResult;
  total: SalesResult;
  byChannel: ChannelSales[];
  byLocation: LocationSales[];
  velocity: { d7: number; d30: number; d90: number; total: number; weeks: Array<{ week: number; units: number }> };
}

export interface FamilySalesResult {
  familyId: string;
  totals: SalesResult;
  byChannel: ChannelSales[];
  byLocation: LocationSales[];
  members: Array<{
    productId: string;
    title: string;
    handle: string;
    image: string | null;
    type: string | null;
    colour: string | null;
    sales: SalesResult;
    squareLinks: number;
  }>;
  squareOnly: Array<{ squareName: string; sales: SalesResult }>;
}

// ─── Helpers ─────────────────────────────────────────────

/** Get all Square names mapped to a product (confirmed/auto/manual/related) */
async function getSquareNames(productId: string): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT lower(trim(square_name)) as name
    FROM product_mappings
    WHERE shopify_product_id = ${productId}
    AND status IN ('confirmed', 'auto', 'manual', 'related')
    AND square_name IS NOT NULL
  `);
  return (rows.rows as any[]).map(r => r.name).filter(Boolean);
}

/** Get all Square names mapped to a family (both product-linked and family-linked) */
async function getFamilySquareNames(familyId: string, memberProductIds: string[]): Promise<{ productLinked: Map<string, string[]>; familyOnly: string[] }> {
  const pidList = memberProductIds.length ? memberProductIds : ['__none__'];
  const rows = await db.execute(sql`
    SELECT lower(trim(square_name)) as name, shopify_product_id, family_id
    FROM product_mappings
    WHERE (family_id = ${familyId} OR shopify_product_id IN (${sql.join(pidList.map(id => sql`${id}`), sql`, `)}))
    AND status IN ('confirmed', 'auto', 'manual', 'related')
    AND square_name IS NOT NULL
  `);

  const productLinked = new Map<string, string[]>();
  const familyOnly: string[] = [];

  for (const r of rows.rows as any[]) {
    if (r.shopify_product_id) {
      const existing = productLinked.get(r.shopify_product_id) ?? [];
      if (!existing.includes(r.name)) existing.push(r.name);
      productLinked.set(r.shopify_product_id, existing);
    } else if (r.family_id === familyId) {
      if (!familyOnly.includes(r.name)) familyOnly.push(r.name);
    }
  }

  return { productLinked, familyOnly };
}

/** Build a WHERE condition matching orders by product IDs and/or Square names */
function buildMatchCondition(productIds: string[], squareNames: string[], sinceDate?: Date) {
  const conditions: any[] = [];

  if (productIds.length) {
    conditions.push(sql`item->>'product_id' IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`);
  }
  if (squareNames.length) {
    conditions.push(sql`lower(trim(item->>'name')) IN (${sql.join(squareNames.map(n => sql`${n}`), sql`, `)})`);
  }

  if (!conditions.length) return null;

  const match = conditions.length === 1 ? conditions[0] : sql`(${sql.join(conditions, sql` OR `)})`;
  const since = sinceDate ? sql`AND o.created_at >= ${sinceDate.toISOString()}` : sql``;

  return { match, since };
}

/** Execute sales aggregation queries */
async function querySales(productIds: string[], squareNames: string[], sinceDate?: Date) {
  const cond = buildMatchCondition(productIds, squareNames, sinceDate);
  if (!cond) return { totals: { units: 0, orders: 0, revenue: 0 }, byChannel: [], byLocation: [], byItem: [] };

  const [totals, byChannel, byLocation, byItem] = await Promise.all([
    db.execute(sql`
      SELECT count(DISTINCT o.shopify_order_id) as orders, count(*) as units,
        coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
      FROM orders_projection o, jsonb_array_elements(o.line_items) as item
      WHERE ${cond.match} ${cond.since}
    `),
    db.execute(sql`
      SELECT o.source, count(DISTINCT o.shopify_order_id) as orders, count(*) as units,
        coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
      FROM orders_projection o, jsonb_array_elements(o.line_items) as item
      WHERE ${cond.match} ${cond.since}
      GROUP BY o.source
    `),
    db.execute(sql`
      SELECT coalesce(o.location_id, 'online') as location_id, count(DISTINCT o.shopify_order_id) as orders,
        count(*) as units,
        coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
      FROM orders_projection o, jsonb_array_elements(o.line_items) as item
      WHERE ${cond.match} ${cond.since}
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT item->>'product_id' as product_id, lower(trim(item->>'name')) as item_name,
        count(*) as units, count(DISTINCT o.shopify_order_id) as orders,
        coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::int, 1)), 0) as revenue
      FROM orders_projection o, jsonb_array_elements(o.line_items) as item
      WHERE ${cond.match} ${cond.since}
      GROUP BY 1, 2
    `),
  ]);

  return {
    totals: toSales(totals.rows[0]),
    byChannel: (byChannel.rows as any[]).map(r => ({ source: r.source, ...toSales(r) })),
    byLocation: (byLocation.rows as any[]).map(r => ({ locationId: r.location_id, ...toSales(r) })),
    byItem: byItem.rows as any[],
  };
}

function toSales(row: any): SalesResult {
  return { units: Number(row?.units ?? 0), orders: Number(row?.orders ?? 0), revenue: Number(row?.revenue ?? 0) };
}

// ─── Public API ──────────────────────────────────────────

/**
 * Get sales data for a single product.
 * Includes direct Shopify sales + Square-linked sales.
 */
export async function getProductSales(productId: string): Promise<ProductSalesResult> {
  const squareNames = await getSquareNames(productId);
  const allNames = squareNames;

  // All-time sales
  const { totals, byChannel, byLocation, byItem } = await querySales([productId], allNames);

  // Split direct vs square
  const directItems = byItem.filter((r: any) => r.product_id === productId);
  const squareItems = byItem.filter((r: any) => r.product_id !== productId || (!r.product_id && allNames.includes(r.item_name)));
  const direct: SalesResult = { units: directItems.reduce((s: number, r: any) => s + Number(r.units), 0), orders: directItems.reduce((s: number, r: any) => s + Number(r.orders), 0), revenue: directItems.reduce((s: number, r: any) => s + Number(r.revenue), 0) };
  const square: SalesResult = { units: squareItems.reduce((s: number, r: any) => s + Number(r.units), 0), orders: squareItems.reduce((s: number, r: any) => s + Number(r.orders), 0), revenue: squareItems.reduce((s: number, r: any) => s + Number(r.revenue), 0) };

  // Velocity (time-based counts from all matching orders)
  const now = Date.now();
  const allOrders = await db.execute(sql`
    SELECT o.created_at, coalesce((item->>'quantity')::int, 1) as qty
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE ${buildMatchCondition([productId], allNames)!.match}
  `);
  const orderTimes = (allOrders.rows as any[]).map(r => ({ time: new Date(r.created_at).getTime(), qty: Number(r.qty) }));

  const d7 = orderTimes.filter(o => o.time > now - 7 * 86400000).reduce((s, o) => s + o.qty, 0);
  const d30 = orderTimes.filter(o => o.time > now - 30 * 86400000).reduce((s, o) => s + o.qty, 0);
  const d90 = orderTimes.filter(o => o.time > now - 90 * 86400000).reduce((s, o) => s + o.qty, 0);
  const total = orderTimes.reduce((s, o) => s + o.qty, 0);

  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = now - (12 - i) * 7 * 86400000;
    const end = start + 7 * 86400000;
    return { week: i + 1, units: orderTimes.filter(o => o.time >= start && o.time < end).reduce((s, o) => s + o.qty, 0) };
  });

  return { productId, direct, square, total: totals, byChannel, byLocation, velocity: { d7, d30, d90, total, weeks } };
}

/**
 * Get sales data for a product family.
 * Includes all member products + family-only Square items.
 */
export async function getFamilySales(familyId: string, sinceDate?: Date): Promise<FamilySalesResult> {
  // Get family members
  const members = await db.execute(sql`
    SELECT m.product_id, m.type, m.colour, p.title, p.handle, p.images->0->>'src' as image
    FROM product_family_members m
    JOIN products_projection p ON p.shopify_product_id = m.product_id
    WHERE m.family_id = ${familyId}
    ORDER BY m.sort_order
  `);
  const memberRows = members.rows as any[];
  const memberProductIds = memberRows.map(m => m.product_id);

  // Get all Square names
  const { productLinked, familyOnly } = await getFamilySquareNames(familyId, memberProductIds);
  const allSquareNames = [...Array.from(productLinked.values()).flat(), ...familyOnly];

  // Query all sales
  const { totals, byChannel, byLocation, byItem } = await querySales(memberProductIds, allSquareNames, sinceDate);

  // Attribute sales to members
  const memberSales = memberRows.map(m => {
    const memberSquareNames = productLinked.get(m.product_id) ?? [];
    const directItems = byItem.filter((r: any) => r.product_id === m.product_id);
    const sqItems = byItem.filter((r: any) => memberSquareNames.includes(r.item_name));
    const sales: SalesResult = {
      units: [...directItems, ...sqItems].reduce((s, r: any) => s + Number(r.units), 0),
      orders: [...directItems, ...sqItems].reduce((s, r: any) => s + Number(r.orders), 0),
      revenue: [...directItems, ...sqItems].reduce((s, r: any) => s + Number(r.revenue), 0),
    };
    return {
      productId: m.product_id,
      title: m.title,
      handle: m.handle,
      image: m.image,
      type: m.type,
      colour: m.colour,
      sales,
      squareLinks: memberSquareNames.length,
    };
  });

  // Family-only Square sales
  const squareOnlySales: Array<{ squareName: string; sales: SalesResult }> = [];
  const seen = new Set<string>();
  for (const name of familyOnly) {
    if (seen.has(name)) continue;
    seen.add(name);
    const items = byItem.filter((r: any) => r.item_name === name);
    squareOnlySales.push({
      squareName: name,
      sales: { units: items.reduce((s, r: any) => s + Number(r.units), 0), orders: items.reduce((s, r: any) => s + Number(r.orders), 0), revenue: items.reduce((s, r: any) => s + Number(r.revenue), 0) },
    });
  }

  return { familyId, totals, byChannel, byLocation, members: memberSales, squareOnly: squareOnlySales };
}

/**
 * Get sales counts for multiple products at once (for list views).
 * Returns a map of productId → { units, squareUnits }.
 */
export async function getBulkProductSales(productIds: string[]): Promise<Map<string, { units: number; squareUnits: number }>> {
  const result = new Map<string, { units: number; squareUnits: number }>();
  if (!productIds.length) return result;

  // Direct sales
  const direct = await db.execute(sql`
    SELECT item->>'product_id' as pid, count(*) as units
    FROM orders_projection o, jsonb_array_elements(o.line_items) as item
    WHERE item->>'product_id' IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})
    GROUP BY 1
  `);
  for (const r of direct.rows as any[]) {
    result.set(r.pid, { units: Number(r.units), squareUnits: 0 });
  }

  // Square-linked sales
  const sqMappings = await db.execute(sql`
    SELECT shopify_product_id, lower(trim(square_name)) as sq_name
    FROM product_mappings
    WHERE shopify_product_id IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})
    AND status IN ('confirmed', 'auto', 'manual', 'related')
    AND square_name IS NOT NULL
  `);
  const pidBySqName = new Map<string, string>();
  for (const r of sqMappings.rows as any[]) {
    if (r.sq_name && r.shopify_product_id) pidBySqName.set(r.sq_name, r.shopify_product_id);
  }

  if (pidBySqName.size > 0) {
    const sqNames = Array.from(pidBySqName.keys());
    const sqSales = await db.execute(sql`
      SELECT lower(trim(item->>'name')) as name, count(*) as units
      FROM orders_projection o, jsonb_array_elements(o.line_items) as item
      WHERE lower(trim(item->>'name')) IN (${sql.join(sqNames.map(n => sql`${n}`), sql`, `)})
      GROUP BY 1
    `);
    for (const r of sqSales.rows as any[]) {
      const pid = pidBySqName.get(r.name);
      if (pid) {
        const existing = result.get(pid) ?? { units: 0, squareUnits: 0 };
        existing.squareUnits += Number(r.units);
        result.set(pid, existing);
      }
    }
  }

  return result;
}
