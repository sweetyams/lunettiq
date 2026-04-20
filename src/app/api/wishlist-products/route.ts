import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

function extractId(gid: string): string {
  return gid.replace(/^gid:\/\/shopify\/Product\//, '');
}

export async function GET(request: NextRequest) {
  const rawIds = request.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  if (!rawIds.length) return NextResponse.json({ data: [] });

  // Handle both GID format and plain numeric IDs
  const ids = rawIds.map(extractId);

  const products = await db.select({
    id: productsProjection.shopifyProductId,
    handle: productsProjection.handle,
    title: productsProjection.title,
    vendor: productsProjection.vendor,
    priceMin: productsProjection.priceMin,
    images: productsProjection.images,
  }).from(productsProjection)
    .where(sql`${productsProjection.shopifyProductId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}])`);

  const data = products.map(p => {
    const imgs = (p.images ?? []) as Array<string | { src?: string }>;
    const img = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;
    // Return the GID format so it matches what the client stores
    const gid = rawIds.find(r => extractId(r) === p.id) ?? p.id;
    return { id: gid, handle: p.handle, title: p.title, vendor: p.vendor, price: p.priceMin ?? '0', imageUrl: img };
  });

  return NextResponse.json({ data });
}
