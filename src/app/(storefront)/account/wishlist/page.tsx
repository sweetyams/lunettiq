import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerMetafield } from '@/lib/shopify/customer';
import type { WishlistData } from '@/types/customer';
import WishlistClient from './WishlistClient';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const accessToken = getAccessToken();
  let productIds: string[] = [];

  try {
    const data = await getCustomerMetafield<WishlistData>(
      'custom',
      'wishlist',
      accessToken ?? undefined
    );
    productIds = data?.productIds ?? [];
  } catch {
    // handled in UI
  }

  return (
    <div className="site-container py-12">
      <h1 className="text-2xl font-medium mb-8">My Wishlist</h1>
      <WishlistClient initialProductIds={productIds} />
    </div>
  );
}
