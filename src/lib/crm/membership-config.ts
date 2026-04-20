/**
 * Lunettiq Membership — single product with 6 variants.
 * 
 * Shopify Product ID: 9128814903553
 * When Selling Plans are added, attach them to this product.
 * Upgrade/downgrade = variant swap on the subscription.
 */

export const MEMBERSHIP_PRODUCT_ID = '9128814903553';

export const MEMBERSHIP_VARIANTS: Record<string, {
  variantId: string;
  variantGid: string;
  tier: 'essential' | 'cult' | 'vault';
  period: 'monthly' | 'annual';
  price: number;
  monthlyCredit: number;
}> = {
  'MEMBERSHIP-ESSENTIAL-MONTHLY': { variantId: '48642305917185', variantGid: 'gid://shopify/ProductVariant/48642305917185', tier: 'essential', period: 'monthly', price: 12, monthlyCredit: 12 },
  'MEMBERSHIP-ESSENTIAL-ANNUAL': { variantId: '48642305949953', variantGid: 'gid://shopify/ProductVariant/48642305949953', tier: 'essential', period: 'annual', price: 120, monthlyCredit: 12 },
  'MEMBERSHIP-CULT-MONTHLY': { variantId: '48642305982721', variantGid: 'gid://shopify/ProductVariant/48642305982721', tier: 'cult', period: 'monthly', price: 25, monthlyCredit: 25 },
  'MEMBERSHIP-CULT-ANNUAL': { variantId: '48642306015489', variantGid: 'gid://shopify/ProductVariant/48642306015489', tier: 'cult', period: 'annual', price: 250, monthlyCredit: 25 },
  'MEMBERSHIP-VAULT-MONTHLY': { variantId: '48642306048257', variantGid: 'gid://shopify/ProductVariant/48642306048257', tier: 'vault', period: 'monthly', price: 45, monthlyCredit: 45 },
  'MEMBERSHIP-VAULT-ANNUAL': { variantId: '48642306081025', variantGid: 'gid://shopify/ProductVariant/48642306081025', tier: 'vault', period: 'annual', price: 450, monthlyCredit: 45 },
};

export function getMembershipBySku(sku: string) {
  return MEMBERSHIP_VARIANTS[sku] ?? null;
}

export function getVariantForTier(tier: string, period: 'monthly' | 'annual') {
  const sku = `MEMBERSHIP-${tier.toUpperCase()}-${period.toUpperCase()}`;
  return MEMBERSHIP_VARIANTS[sku] ?? null;
}
