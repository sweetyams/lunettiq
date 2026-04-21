import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/storefront/family/[handle]
 * Accepts slug or raw handle. Returns siblings with slugs for URL construction.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { handle: string } }
) {
  const slug = decodeURIComponent(params.handle);

  const rows = await db.execute(sql`
    SELECT m.product_id, m.type, m.colour, m.colour_hex, m.sort_order,
           COALESCE(p.slug, p.handle) as slug, p.title, p.images->0->>'src' as image
    FROM product_family_members m
    JOIN products_projection p ON p.shopify_product_id = m.product_id
    WHERE m.family_id = (
      SELECT m2.family_id FROM product_family_members m2
      JOIN products_projection p2 ON p2.shopify_product_id = m2.product_id
      WHERE p2.slug = ${slug} OR p2.handle = ${slug}
      LIMIT 1
    )
    AND p.status = 'active'
    ORDER BY m.sort_order
  `);

  if (rows.rows.length === 0) {
    return NextResponse.json({ data: null }, {
      headers: { 'Cache-Control': process.env.NODE_ENV === 'development' ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  }

  // Group by colour
  const colours = new Map<string, { colour: string; hex: string | null; optical: any | null; sun: any | null }>();
  for (const r of rows.rows as any[]) {
    const key = r.colour ?? r.slug;
    if (!colours.has(key)) colours.set(key, { colour: key, hex: r.colour_hex, optical: null, sun: null });
    const entry = colours.get(key)!;
    const product = { productId: r.product_id, slug: r.slug, title: r.title, image: r.image };
    if (r.type === 'sun') entry.sun = product;
    else entry.optical = product;
  }

  return NextResponse.json({
    data: {
      currentHandle: slug,
      siblings: Array.from(colours.values()),
    },
  }, {
    headers: { 'Cache-Control': process.env.NODE_ENV === 'development' ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
