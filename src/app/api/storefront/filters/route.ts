export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { colourGroups } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * GET /api/storefront/filters
 * Returns filter options + product→filter mappings from DB metafields.
 * Colour groups collapse raw colours into display groups.
 */
export async function GET(request: NextRequest) {
  const [rows, groups] = await Promise.all([
    db.execute(sql`
      SELECT
        p.shopify_product_id as id,
        p.metafields->'udesly'->>'available-in-these-colors' as colours_raw,
        p.metafields->'udesly'->>'face-shape-recommendation' as shapes_raw,
        p.metafields->'custom'->>'material' as material,
        p.metafields->'custom'->>'sizing_dimensions' as sizing
      FROM products_projection p
      WHERE p.status = 'active'
    `),
    db.select().from(colourGroups).orderBy(colourGroups.sortOrder),
  ]);

  // Build reverse map: raw colour → group id
  const colourToGroup = new Map<string, string>();
  for (const g of groups) {
    for (const member of g.members) colourToGroup.set(member, g.id);
  }

  const productFilters: Record<string, { colours: string[]; shapes: string[]; material: string | null; size: string | null }> = {};
  const allColours = new Set<string>();
  const allShapes = new Set<string>();
  const allMaterials = new Set<string>();

  for (const row of rows.rows as any[]) {
    const colours: string[] = [];
    const shapes: string[] = [];

    if (row.colours_raw) {
      try {
        for (const c of JSON.parse(row.colours_raw)) {
          const grouped = colourToGroup.get(c.handle) ?? c.handle;
          if (!colours.includes(grouped)) colours.push(grouped);
          allColours.add(grouped);
        }
      } catch {}
    }
    if (row.shapes_raw) {
      try { for (const s of JSON.parse(row.shapes_raw)) { shapes.push(s.handle); allShapes.add(s.handle); } } catch {}
    }

    let material: string | null = null;
    if (row.material) { material = row.material.toLowerCase(); allMaterials.add(material); }

    let size: string | null = null;
    if (row.sizing) {
      const fwMatch = row.sizing.match(/Frame width:\s*(\d+)/i);
      if (fwMatch) {
        const fw = Number(fwMatch[1]);
        size = fw <= 128 ? 'small' : fw <= 138 ? 'medium' : 'large';
      }
    }

    productFilters[row.id] = { colours, shapes, material, size };
  }

  // Use group labels for display
  const groupLabels = new Map(groups.map(g => [g.id, g.label]));

  return NextResponse.json({
    data: {
      options: {
        colour: Array.from(allColours).sort(),
        shape: Array.from(allShapes).sort(),
        material: Array.from(allMaterials).sort(),
        size: ['small', 'medium', 'large'],
      },
      colourLabels: Object.fromEntries(groups.map(g => [g.id, g.label])),
      products: productFilters,
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
