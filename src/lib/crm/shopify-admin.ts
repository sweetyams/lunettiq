/**
 * Shopify Admin API write-through layer for Lunettiq CRM.
 *
 * Every CRM edit writes back to Shopify (source of truth) via REST Admin API 2024-01.
 * File uploads use the GraphQL Admin API (stagedUploadsCreate + fileCreate).
 */

import type {
  AdminResult,
  CustomerFields,
  ShopifyCustomer,
  ShopifyCustomerResponse,
  ShopifyMetafield,
  ShopifyMetafieldResponse,
  ShopifyMetafieldsResponse,
  StagedUploadTarget,
} from './shopify-admin.types';

let _apiVersion: string | null = null;
async function getApiVersion(): Promise<string> {
  if (_apiVersion) return _apiVersion;
  const { getSetting } = await import('./store-settings');
  _apiVersion = await getSetting('shopify_admin_api_version');
  return _apiVersion;
}

function getShop(): string {
  return process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
}

async function getToken(): Promise<string> {
  const { getKey } = await import('./integration-keys');
  return (await getKey('SHOPIFY_ADMIN_API_ACCESS_TOKEN')) ?? process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
}

async function restUrl(path: string): Promise<string> {
  const v = await getApiVersion();
  return `https://${getShop()}/admin/api/${v}${path}`;
}

async function graphqlUrl(): Promise<string> {
  const v = await getApiVersion();
  return `https://${getShop()}/admin/api/${v}/graphql.json`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function restFetch<T>(path: string, options: RequestInit = {}): Promise<AdminResult<T>> {
  try {
    const token = await getToken();
    const url = await restUrl(path);
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
        ...options.headers,
      },
    });
    if (!res.ok) {
      return { ok: false as const, error: `Shopify ${res.status}: ${await res.text()}` };
    }
    return { ok: true as const, data: (await res.json()) as T };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

async function graphqlFetch<T>(query: string, variables?: Record<string, unknown>): Promise<AdminResult<T>> {
  try {
    const token = await getToken();
    const url = await graphqlUrl();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      return { ok: false as const, error: `Shopify GraphQL ${res.status}: ${await res.text()}` };
    }
    const json = await res.json();
    if (json.errors?.length) {
      return { ok: false as const, error: json.errors.map((e: { message: string }) => e.message).join(', ') };
    }
    return { ok: true as const, data: json.data as T };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
}

/** Unwrap error from an AdminResult for re-wrapping into a different generic. */
function propagateError<T>(r: { ok: false; error: string }): AdminResult<T> {
  return { ok: false, error: r.error };
}

/** Fetch a single customer by ID (internal). */
async function fetchCustomer(id: number): Promise<AdminResult<ShopifyCustomer>> {
  const r = await restFetch<ShopifyCustomerResponse>(`/customers/${id}.json`, { method: 'GET' });
  if (r.ok === false) return propagateError(r);
  return { ok: true, data: r.data.customer };
}

// ---------------------------------------------------------------------------
// Customer CRUD
// ---------------------------------------------------------------------------

/** Create a new customer in Shopify. Returns the Shopify customer ID. */
export async function createCustomer(fields: CustomerFields): Promise<AdminResult<number>> {
  const r = await restFetch<ShopifyCustomerResponse>('/customers.json', {
    method: 'POST',
    body: JSON.stringify({ customer: fields }),
  });
  if (r.ok === false) return propagateError(r);
  return { ok: true, data: r.data.customer.id };
}

/** Update a customer's core fields (name, email, phone, tags, addresses, etc.). */
export async function updateCustomer(
  shopifyCustomerId: number,
  fields: Partial<CustomerFields>
): Promise<AdminResult<ShopifyCustomer>> {
  const r = await restFetch<ShopifyCustomerResponse>(`/customers/${shopifyCustomerId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ customer: { id: shopifyCustomerId, ...fields } }),
  });
  if (r.ok === false) return propagateError(r);
  return { ok: true, data: r.data.customer };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

function parseTags(tagString: string): string[] {
  return tagString.split(',').map((t) => t.trim()).filter(Boolean);
}

/** Replace all tags on a customer. */
export async function updateCustomerTags(
  shopifyCustomerId: number,
  tags: string[]
): Promise<AdminResult<ShopifyCustomer>> {
  return updateCustomer(shopifyCustomerId, { tags: tags.join(', ') });
}

/** Add a single tag without removing existing ones. */
export async function addCustomerTag(
  shopifyCustomerId: number,
  tag: string
): Promise<AdminResult<ShopifyCustomer>> {
  const current = await fetchCustomer(shopifyCustomerId);
  if (current.ok === false) return propagateError(current);

  const existing = parseTags(current.data.tags);
  if (!existing.includes(tag)) existing.push(tag);
  return updateCustomer(shopifyCustomerId, { tags: existing.join(', ') });
}

/** Remove a single tag from a customer. */
export async function removeCustomerTag(
  shopifyCustomerId: number,
  tag: string
): Promise<AdminResult<ShopifyCustomer>> {
  const current = await fetchCustomer(shopifyCustomerId);
  if (current.ok === false) return propagateError(current);

  const filtered = parseTags(current.data.tags).filter((t) => t !== tag);
  return updateCustomer(shopifyCustomerId, { tags: filtered.join(', ') });
}

// ---------------------------------------------------------------------------
// Metafields
// ---------------------------------------------------------------------------

/** Fetch all metafields for a customer. */
export async function getCustomerMetafields(
  shopifyCustomerId: number
): Promise<AdminResult<ShopifyMetafield[]>> {
  const r = await restFetch<ShopifyMetafieldsResponse>(
    `/customers/${shopifyCustomerId}/metafields.json`,
    { method: 'GET' }
  );
  if (r.ok === false) return propagateError(r);
  return { ok: true, data: r.data.metafields };
}

/** Fetch all metafields for a product. */
export async function getProductMetafields(
  shopifyProductId: number
): Promise<AdminResult<ShopifyMetafield[]>> {
  const r = await restFetch<ShopifyMetafieldsResponse>(
    `/products/${shopifyProductId}/metafields.json`,
    { method: 'GET' }
  );
  if (r.ok === false) return propagateError(r);
  return { ok: true, data: r.data.metafields };
}

/** Create or update a single metafield on a customer. */
export async function updateCustomerMetafield(
  shopifyCustomerId: number,
  namespace: string,
  key: string,
  value: string,
  type: string = 'single_line_text_field'
): Promise<AdminResult<ShopifyMetafield>> {
  const r = await restFetch<ShopifyMetafieldResponse>(
    `/customers/${shopifyCustomerId}/metafields.json`,
    {
      method: 'POST',
      body: JSON.stringify({ metafield: { namespace, key, value, type } }),
    }
  );
  if (r.ok === false) return propagateError(r);
  return { ok: true, data: r.data.metafield };
}

// ---------------------------------------------------------------------------
// File upload (GraphQL — stagedUploadsCreate → HTTP PUT → fileCreate)
// ---------------------------------------------------------------------------

const STAGED_UPLOADS_MUTATION = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE_MUTATION = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id alt createdAt }
      userErrors { field message }
    }
  }
`;

type StagedUploadsResult = {
  stagedUploadsCreate: {
    stagedTargets: StagedUploadTarget[];
    userErrors: { field: string; message: string }[];
  };
};

type FileCreateResult = {
  fileCreate: {
    files: { id: string }[];
    userErrors: { field: string; message: string }[];
  };
};

/** Upload a file to Shopify Files API. Returns the hosted file URL. */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<AdminResult<string>> {
  // 1. Create staged upload target
  const staged = await graphqlFetch<StagedUploadsResult>(STAGED_UPLOADS_MUTATION, {
    input: [{ filename, mimeType, httpMethod: 'PUT', resource: 'FILE' }],
  });
  if (staged.ok === false) return propagateError(staged);

  const { stagedTargets, userErrors } = staged.data.stagedUploadsCreate;
  if (userErrors.length) {
    return { ok: false, error: userErrors.map((e) => e.message).join(', ') };
  }

  const target = stagedTargets[0];
  if (!target) return { ok: false, error: 'No staged upload target returned' };

  // 2. Upload file to the staged URL
  try {
    const uploadRes = await fetch(target.url, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: new Uint8Array(buffer),
    });
    if (!uploadRes.ok) return { ok: false, error: `Staged upload failed: ${uploadRes.status}` };
  } catch (e) {
    return { ok: false, error: `Staged upload failed: ${(e as Error).message}` };
  }

  // 3. Register the file in Shopify
  const fc = await graphqlFetch<FileCreateResult>(FILE_CREATE_MUTATION, {
    files: [{ originalSource: target.resourceUrl, contentType: 'IMAGE' }],
  });
  if (fc.ok === false) return propagateError(fc);

  if (fc.data.fileCreate.userErrors.length) {
    return { ok: false, error: fc.data.fileCreate.userErrors.map((e) => e.message).join(', ') };
  }

  return { ok: true, data: target.resourceUrl };
}
