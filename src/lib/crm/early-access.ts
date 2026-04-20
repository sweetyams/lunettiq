import { getTierFromTags } from '@/lib/crm/loyalty-config';

const TIER_RANK: Record<string, number> = { essential: 1, cult: 2, vault: 3 };

/**
 * Check if a product's tags indicate early access restriction.
 * Returns true if the customer can see the product.
 */
export function canAccessProduct(productTags: string[] | null, customerTier: string | null): boolean {
  if (!productTags) return true;

  const earlyAccessTag = productTags.find(t => t.startsWith('early-access-'));
  if (!earlyAccessTag) return true; // no restriction

  const requiredTier = earlyAccessTag.replace('early-access-', '');
  const requiredRank = TIER_RANK[requiredTier] ?? 0;
  const customerRank = customerTier ? (TIER_RANK[customerTier] ?? 0) : 0;

  return customerRank >= requiredRank;
}

/**
 * Filter a list of products based on customer tier access.
 */
export function filterByAccess<T extends { tags: string[] | null }>(products: T[], customerTier: string | null): T[] {
  return products.filter(p => canAccessProduct(p.tags, customerTier));
}

/**
 * Get the early access tier label for a product, if any.
 */
export function getEarlyAccessLabel(productTags: string[] | null): string | null {
  if (!productTags) return null;
  const tag = productTags.find(t => t.startsWith('early-access-'));
  if (!tag) return null;
  const tier = tag.replace('early-access-', '').toUpperCase();
  return `${tier} Early Access`;
}
