import { NextRequest, NextResponse } from 'next/server';
import { getProductByHandle } from '@/lib/shopify/queries/product';

/**
 * GET /api/storefront/product/[handle]
 * Client-side product fetch for instant family navigation.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { handle: string } }
) {
  const handle = decodeURIComponent(params.handle);
  const product = await getProductByHandle(handle);

  if (!product) {
    return NextResponse.json({ product: null }, { status: 404 });
  }

  return NextResponse.json({ product }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
