import { NextRequest, NextResponse } from 'next/server';
import { resolveChannelsForProduct } from '@/lib/crm/configurator-resolve';

/**
 * GET /api/storefront/configurator/resolve?productId=X
 * Public. Returns resolved channel(s) for a product.
 */
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

  const channels = await resolveChannelsForProduct(productId);
  return NextResponse.json({ productId, channels });
}
