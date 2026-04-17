export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerMetafield, setCustomerMetafield } from '@/lib/shopify/customer';
import type { WishlistData } from '@/types/customer';

export async function GET() {
  const token = getAccessToken();
  if (!token) {
    return NextResponse.json({ productIds: [] }, { status: 401 });
  }

  try {
    const data = await getCustomerMetafield<WishlistData>('custom', 'wishlist', token);
    return NextResponse.json(data ?? { productIds: [] });
  } catch {
    return NextResponse.json({ productIds: [] }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const productIds: string[] = body.productIds ?? [];
    await setCustomerMetafield('custom', 'wishlist', { productIds }, 'json', token);
    return NextResponse.json({ productIds });
  } catch {
    return NextResponse.json({ error: 'Failed to update wishlist' }, { status: 500 });
  }
}
