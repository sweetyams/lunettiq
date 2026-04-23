/**
 * Square API Client — READ-ONLY
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HARD RULE: This client ONLY reads data from Square.        ║
 * ║  NO writes, NO updates, NO deletes, NO mutations.           ║
 * ║  All methods use GET requests only.                         ║
 * ║  If you need to write to Square, create a separate module   ║
 * ║  with explicit approval and audit logging.                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const SQUARE_BASE = {
  sandbox: 'https://connect.squareupsandbox.com/v2',
  production: 'https://connect.squareup.com/v2',
};

function getBaseUrl(): string {
  const env = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
  return SQUARE_BASE[env as keyof typeof SQUARE_BASE] ?? SQUARE_BASE.sandbox;
}

function getToken(): string {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN not set');
  return token;
}

async function resolveToken(): Promise<string> {
  const { getKey } = await import('@/lib/crm/integration-keys');
  return (await getKey('SQUARE_ACCESS_TOKEN')) ?? getToken();
}

async function squareGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${getBaseUrl()}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const token = await resolveToken();

  const res = await fetch(url.toString(), {
    method: 'GET', // READ-ONLY: only GET requests allowed
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Square API ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

// Square Orders API uses POST for search (not a mutation — it's a query)
async function squareSearch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await resolveToken();
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Square API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Public API (all read-only) ──────────────────────────

export interface SquareOrder {
  id: string;
  location_id: string;
  created_at: string;
  updated_at: string;
  state: string;
  total_money?: { amount: number; currency: string };
  line_items?: Array<{
    uid: string;
    name: string;
    quantity: string;
    base_price_money?: { amount: number; currency: string };
    total_money?: { amount: number; currency: string };
    catalog_object_id?: string;
    variation_name?: string;
  }>;
  tenders?: Array<{ type: string; amount_money?: { amount: number; currency: string } }>;
  customer_id?: string;
  reference_id?: string;
}

export interface SquareCustomer {
  id: string;
  given_name?: string;
  family_name?: string;
  email_address?: string;
  phone_number?: string;
  company_name?: string;
  birthday?: string;
  note?: string;
  preferences?: { email_unsubscribed?: boolean };
  created_at: string;
  updated_at: string;
  address?: { address_line_1?: string; address_line_2?: string; locality?: string; administrative_district_level_1?: string; postal_code?: string; country?: string };
}

export async function getOrder(orderId: string): Promise<SquareOrder> {
  const data = await squareGet<{ order: SquareOrder }>(`/orders/${orderId}`);
  return data.order;
}

export async function searchOrders(locationIds: string[], opts?: {
  startDate?: string;
  endDate?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ orders: SquareOrder[]; cursor?: string }> {
  const query: Record<string, unknown> = {
    location_ids: locationIds,
    limit: opts?.limit ?? 50,
    return_entries: false,
  };

  if (opts?.startDate || opts?.endDate) {
    query.query = {
      filter: {
        date_time_filter: {
          created_at: {
            ...(opts.startDate ? { start_at: opts.startDate } : {}),
            ...(opts.endDate ? { end_at: opts.endDate } : {}),
          },
        },
        state_filter: { states: ['COMPLETED'] },
      },
      sort: { sort_field: 'CREATED_AT', sort_order: 'DESC' },
    };
  }

  if (opts?.cursor) query.cursor = opts.cursor;

  const data = await squareSearch<{ orders?: SquareOrder[]; cursor?: string }>('/orders/search', query);
  return { orders: data.orders ?? [], cursor: data.cursor };
}

export async function getCustomer(customerId: string): Promise<SquareCustomer> {
  const data = await squareGet<{ customer: SquareCustomer }>(`/customers/${customerId}`);
  return data.customer;
}

export async function listLocations(): Promise<Array<{ id: string; name: string; address?: any }>> {
  const data = await squareGet<{ locations: Array<{ id: string; name: string; address?: any }> }>('/locations');
  return data.locations ?? [];
}

/** Get inventory counts for catalog items at locations. READ-ONLY. */
export async function getInventoryCounts(catalogObjectIds: string[], locationIds: string[]): Promise<Array<{ catalogObjectId: string; locationId: string; quantity: number }>> {
  const token = await resolveToken();
  const base = getBaseUrl();
  const res = await fetch(`${base}/inventory/counts/batch-retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'Square-Version': '2024-10-17' },
    body: JSON.stringify({ catalog_object_ids: catalogObjectIds, location_ids: locationIds, states: ['IN_STOCK'] }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.counts ?? []).map((c: any) => ({
    catalogObjectId: c.catalog_object_id,
    locationId: c.location_id,
    quantity: parseFloat(c.quantity ?? '0'),
  }));
}
