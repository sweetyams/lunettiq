export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { filterGroups, productFilters, productsProjection } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

/**
 * GET /api/storefront/filters
 * Returns filter options + product→filter mappings from the CRM-managed filter system.
 */
export async function GET(request: NextRequest) {
  // Get all filter groups
  const groups = await db.select().from(filterGroups).orderBy(filterGroups.type, filterGroups.sortOrder);

  // Get all product assignments
  const assignments = await db.execute(sql`
    SELECT pf.product_id, pf.filter_group_id, p.handle
    FROM product_filters pf
    JOIN products_projection p ON p.shopify_product_id = pf.product_id
    WHERE p.status = 'active'
  `);

  // Build options by type
  const options: Record<string, string[]> = {};
  const labels: Record<string, string> = {};
  for (const g of groups) {
    if (!options[g.type]) options[g.type] = [];
    options[g.type].push(g.slug);
    labels[g.slug] = g.label;
  }

  // Build product→filters map (keyed by both ID and handle)
  const productMap: Record<string, Record<string, string[]>> = {};
  for (const row of assignments.rows as any[]) {
    const [type, slug] = (row.filter_group_id as string).split(':');
    if (!type || !slug) continue;

    // Key by product ID
    if (!productMap[row.product_id]) productMap[row.product_id] = {};
    if (!productMap[row.product_id][type]) productMap[row.product_id][type] = [];
    productMap[row.product_id][type].push(slug);

    // Also key by handle
    if (row.handle) {
      if (!productMap[row.handle]) productMap[row.handle] = {};
      if (!productMap[row.handle][type]) productMap[row.handle][type] = [];
      productMap[row.handle][type].push(slug);
    }
  }

  // Transform to the format the frontend expects
  const products: Record<string, { colours: string[]; shapes: string[]; material: string | null; size: string | null }> = {};
  for (const [key, filters] of Object.entries(productMap)) {
    products[key] = {
      colours: filters.colour ?? [],
      shapes: filters.shape ?? [],
      material: filters.material?.[0] ?? null,
      size: filters.size?.[0] ?? null,
    };
  }

  return NextResponse.json({
    data: { options, colourLabels: labels, products },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
