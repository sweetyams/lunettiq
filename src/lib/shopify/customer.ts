/**
 * Shopify Customer Account API client.
 *
 * Provides a generic GraphQL query function for the Customer Account API,
 * plus typed helpers for profile, orders, addresses, wishlist, prescriptions,
 * and loyalty data.
 *
 * Requirements: 27.2, 22.3
 */

import { getCustomerApiUrl, getAccessToken } from './auth';

export class CustomerApiError extends Error {
  public readonly status: number;
  public readonly graphqlErrors?: Array<{ message: string }>;

  constructor(
    message: string,
    status: number,
    graphqlErrors?: Array<{ message: string }>
  ) {
    super(message);
    this.name = 'CustomerApiError';
    this.status = status;
    this.graphqlErrors = graphqlErrors;
  }
}

/**
 * Execute a GraphQL query against the Shopify Customer Account API.
 *
 * Requires a valid access token (from auth cookies).
 * Throws CustomerApiError on failure.
 */
export async function customerFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  accessToken?: string
): Promise<T> {
  const token = accessToken ?? getAccessToken();

  if (!token) {
    throw new CustomerApiError('No access token available', 401);
  }

  const response = await fetch(getCustomerApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new CustomerApiError(
      `Customer Account API request failed with status ${response.status}`,
      response.status
    );
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    throw new CustomerApiError(
      `Customer Account API GraphQL errors: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`,
      200,
      json.errors
    );
  }

  return json.data as T;
}

// --- GraphQL Queries ---

const CUSTOMER_PROFILE_QUERY = `
  query CustomerProfile {
    customer {
      id
      firstName
      lastName
      email
      phone
      defaultAddress {
        id
        address1
        address2
        city
        province
        country
        zip
        phone
      }
      addresses(first: 10) {
        nodes {
          id
          address1
          address2
          city
          province
          country
          zip
          phone
        }
      }
    }
  }
`;

const CUSTOMER_ORDERS_QUERY = `
  query CustomerOrders($first: Int!) {
    customer {
      orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
        nodes {
          id
          name
          processedAt
          financialStatus
          fulfillmentStatus
          totalPrice {
            amount
            currencyCode
          }
          lineItems(first: 50) {
            nodes {
              title
              quantity
              variant {
                image {
                  url
                  altText
                }
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

const CUSTOMER_METAFIELD_QUERY = `
  query CustomerMetafield($namespace: String!, $key: String!) {
    customer {
      metafield(namespace: $namespace, key: $key) {
        id
        value
        type
      }
    }
  }
`;

const CUSTOMER_METAFIELD_UPSERT_MUTATION = `
  mutation CustomerMetafieldUpsert($input: CustomerMetafieldInput!) {
    customerMetafieldUpdate(input: $input) {
      customer {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// --- Typed Helper Functions ---

export interface CustomerProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  defaultAddress: CustomerAddress | null;
  addresses: CustomerAddress[];
}

export interface CustomerAddress {
  id: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string | null;
}

export interface CustomerOrder {
  id: string;
  name: string;
  processedAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPrice: { amount: string; currencyCode: string };
  lineItems: Array<{
    title: string;
    quantity: number;
    variant: {
      image: { url: string; altText: string | null } | null;
      price: { amount: string; currencyCode: string };
    } | null;
  }>;
}

/**
 * Fetch the authenticated customer's profile.
 */
export async function getCustomerProfile(accessToken?: string): Promise<CustomerProfile> {
  const data = await customerFetch<{
    customer: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      phone: string | null;
      defaultAddress: CustomerAddress | null;
      addresses: { nodes: CustomerAddress[] };
    };
  }>(CUSTOMER_PROFILE_QUERY, undefined, accessToken);

  return {
    ...data.customer,
    addresses: data.customer.addresses.nodes,
  };
}

/**
 * Fetch the authenticated customer's order history.
 */
export async function getCustomerOrders(
  first = 20,
  accessToken?: string
): Promise<CustomerOrder[]> {
  const data = await customerFetch<{
    customer: {
      orders: {
        nodes: Array<{
          id: string;
          name: string;
          processedAt: string;
          financialStatus: string;
          fulfillmentStatus: string;
          totalPrice: { amount: string; currencyCode: string };
          lineItems: {
            nodes: Array<{
              title: string;
              quantity: number;
              variant: {
                image: { url: string; altText: string | null } | null;
                price: { amount: string; currencyCode: string };
              } | null;
            }>;
          };
        }>;
      };
    };
  }>(CUSTOMER_ORDERS_QUERY, { first }, accessToken);

  return data.customer.orders.nodes.map((order) => ({
    ...order,
    lineItems: order.lineItems.nodes,
  }));
}

/**
 * Read a customer metafield value (parsed as JSON).
 */
export async function getCustomerMetafield<T>(
  namespace: string,
  key: string,
  accessToken?: string
): Promise<T | null> {
  const data = await customerFetch<{
    customer: {
      metafield: { id: string; value: string; type: string } | null;
    };
  }>(CUSTOMER_METAFIELD_QUERY, { namespace, key }, accessToken);

  const metafield = data.customer.metafield;
  if (!metafield) return null;

  try {
    return JSON.parse(metafield.value) as T;
  } catch {
    return metafield.value as unknown as T;
  }
}

/**
 * Upsert a customer metafield value (serialized as JSON).
 */
export async function setCustomerMetafield(
  namespace: string,
  key: string,
  value: unknown,
  type = 'json',
  accessToken?: string
): Promise<void> {
  const data = await customerFetch<{
    customerMetafieldUpdate: {
      userErrors: Array<{ field: string; message: string }>;
    };
  }>(
    CUSTOMER_METAFIELD_UPSERT_MUTATION,
    {
      input: {
        namespace,
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        type,
      },
    },
    accessToken
  );

  const errors = data.customerMetafieldUpdate.userErrors;
  if (errors.length > 0) {
    throw new CustomerApiError(
      `Metafield upsert failed: ${errors.map((e) => e.message).join(', ')}`,
      422
    );
  }
}
