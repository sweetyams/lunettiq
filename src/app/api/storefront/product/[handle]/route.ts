import { NextRequest, NextResponse } from 'next/server';
import { getProductByHandle } from '@/lib/shopify/queries/product';
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function resolve(slug: string): Promise<{ shopifyHandle: string; slug: string } | null> {
  const [bySlug] = await db
    .select({ handle: productsProjection.handle, slug: productsProjection.slug })
    .from(productsProjection)
    .where(eq(productsProjection.slug, slug))
    .limit(1);
  if (bySlug?.handle) return { shopifyHandle: bySlug.handle, slug: bySlug.slug! };

  const [byHandle] = await db
    .select({ handle: productsProjection.handle, slug: productsProjection.slug })
    .from(productsProjection)
    .where(eq(productsProjection.handle, slug))
    .limit(1);
  if (byHandle?.handle) return { shopifyHandle: byHandle.handle, slug: byHandle.slug! };

  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { handle: string } }
) {
  const input = decodeURIComponent(params.handle);
  if (!input) return NextResponse.json({ product: null }, { status: 404 });

  const resolved = await resolve(input);
  const shopifyHandle = resolved?.shopifyHandle ?? input;
  const product = await getProductByHandle(shopifyHandle);
  if (!product) return NextResponse.json({ product: null }, { status: 404 });

  return NextResponse.json({ product, slug: resolved?.slug ?? input }, {
    headers: { 'Cache-Control': process.env.NODE_ENV === 'development' ? 'no-store' : 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
