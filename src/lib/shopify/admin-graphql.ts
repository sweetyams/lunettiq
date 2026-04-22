/**
 * Shopify Admin GraphQL API client.
 *
 * Thin wrapper for mutations/queries that don't fit the CRM REST layer
 * (e.g. draft orders, price rules).
 */

import type { AdminResult } from '@/lib/crm/shopify-admin.types';

async function getApiVersion(): Promise<string> {
  const { getSetting } = await import('@/lib/crm/store-settings');
  return getSetting('shopify_admin_api_version');
}

function getShop(): string {
  return process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
}

async function getToken(): Promise<string> {
  const { getKey } = await import('@/lib/crm/integration-keys');
  return (await getKey('SHOPIFY_ADMIN_API_ACCESS_TOKEN')) ?? process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
}

export async function graphqlAdmin<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<AdminResult<T>> {
  try {
    const [token, version] = await Promise.all([getToken(), getApiVersion()]);
    const url = `https://${getShop()}/admin/api/${version}/graphql.json`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      return { ok: false, error: `Shopify Admin ${res.status}: ${await res.text()}` };
    }

    const json = await res.json();
    if (json.errors?.length) {
      return { ok: false, error: json.errors.map((e: { message: string }) => e.message).join(', ') };
    }

    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
