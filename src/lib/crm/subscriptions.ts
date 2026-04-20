/**
 * Shopify Subscription management — handles upgrades, downgrades, cancellations.
 * Uses the Subscription Contract Admin API.
 *
 * Flow:
 *   Customer buys membership with selling plan → Shopify creates subscription contract
 *   On renewal → orders/create webhook fires → Inngest issues monthly credits
 *   Upgrade → swap variant on the contract
 *   Cancel → cancel the contract (60-day grace)
 */

import { MEMBERSHIP_VARIANTS } from './membership-config';

const GQL = () => `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`;
const TOKEN = () => process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;

async function adminGql<T>(query: string, variables?: any): Promise<T | null> {
  const res = await fetch(GQL(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN() },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) { console.error('Subscription GQL error:', json.errors[0]?.message); return null; }
  return json.data;
}

/**
 * Find active subscription contracts for a customer.
 */
export async function getCustomerSubscriptions(customerId: string) {
  const data = await adminGql<any>(`
    query($customerId: ID!) {
      customer(id: $customerId) {
        subscriptionContracts(first: 5) {
          nodes {
            id status
            lines(first: 5) { nodes { variantId quantity currentPrice { amount currencyCode } } }
            billingPolicy { interval intervalCount }
            nextBillingDate
          }
        }
      }
    }
  `, { customerId: `gid://shopify/Customer/${customerId}` });

  return data?.customer?.subscriptionContracts?.nodes ?? [];
}

/**
 * Update a subscription contract — swap variant (upgrade/downgrade).
 */
export async function updateSubscriptionVariant(contractId: string, lineId: string, newVariantId: string, newPrice: string) {
  // Create a draft
  const draft = await adminGql<any>(`
    mutation($contractId: ID!) {
      subscriptionContractUpdate(contractId: $contractId) {
        draft { id }
        userErrors { field message }
      }
    }
  `, { contractId });

  const draftId = draft?.subscriptionContractUpdate?.draft?.id;
  if (!draftId) return { ok: false, error: 'Failed to create draft' };

  // Update the line
  await adminGql(`
    mutation($draftId: ID!, $lineId: ID!, $input: SubscriptionLineUpdateInput!) {
      subscriptionDraftLineUpdate(draftId: $draftId, lineId: $lineId, input: $input) {
        userErrors { field message }
      }
    }
  `, {
    draftId,
    lineId,
    input: { productVariantId: `gid://shopify/ProductVariant/${newVariantId}`, currentPrice: { amount: newPrice, currencyCode: 'CAD' } },
  });

  // Commit the draft
  const commit = await adminGql<any>(`
    mutation($draftId: ID!) {
      subscriptionDraftCommit(draftId: $draftId) {
        contract { id status }
        userErrors { field message }
      }
    }
  `, { draftId });

  if (commit?.subscriptionDraftCommit?.userErrors?.length) {
    return { ok: false, error: commit.subscriptionDraftCommit.userErrors[0].message };
  }

  return { ok: true };
}

/**
 * Cancel a subscription contract.
 */
export async function cancelSubscription(contractId: string) {
  const data = await adminGql<any>(`
    mutation($contractId: ID!) {
      subscriptionContractCancel(contractId: $contractId) {
        contract { id status }
        userErrors { field message }
      }
    }
  `, { contractId });

  if (data?.subscriptionContractCancel?.userErrors?.length) {
    return { ok: false, error: data.subscriptionContractCancel.userErrors[0].message };
  }
  return { ok: true };
}

/**
 * Pause a subscription (skip next billing cycle).
 */
export async function pauseSubscription(contractId: string) {
  const data = await adminGql<any>(`
    mutation($contractId: ID!) {
      subscriptionContractPause(contractId: $contractId) {
        contract { id status }
        userErrors { field message }
      }
    }
  `, { contractId });

  if (data?.subscriptionContractPause?.userErrors?.length) {
    return { ok: false, error: data.subscriptionContractPause.userErrors[0].message };
  }
  return { ok: true };
}

/**
 * Activate/resume a paused subscription.
 */
export async function activateSubscription(contractId: string) {
  const data = await adminGql<any>(`
    mutation($contractId: ID!) {
      subscriptionContractActivate(contractId: $contractId) {
        contract { id status }
        userErrors { field message }
      }
    }
  `, { contractId });

  if (data?.subscriptionContractActivate?.userErrors?.length) {
    return { ok: false, error: data.subscriptionContractActivate.userErrors[0].message };
  }
  return { ok: true };
}

/**
 * Get the right variant for a tier change.
 */
export function getVariantForChange(newTier: string, currentPeriod: 'monthly' | 'annual') {
  const sku = `MEMBERSHIP-${newTier.toUpperCase()}-${currentPeriod.toUpperCase()}`;
  return MEMBERSHIP_VARIANTS[sku] ?? null;
}
