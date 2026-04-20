export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean) ?? [];
  if (ids.length === 0) return NextResponse.json({ products: [] });

  const rows = await db.select({
    id: productsProjection.shopifyProductId,
    handle: productsProjection.handle,
    title: productsProjection.title,
    priceMin: productsProjection.priceMin,
    images: productsProjection.images,
  }).from(productsProjection).where(inArray(productsProjection.shopifyProductId, ids.slice(0, 20)));

  const products = rows.map(r => {
    const imgs = (r.images ?? []) as Array<string | { src?: string }>;
    const imageUrl = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;
    return { id: r.id, handle: r.handle, title: r.title, priceMin: r.priceMin, imageUrl };
  });

  return NextResponse.json({ products });
}
