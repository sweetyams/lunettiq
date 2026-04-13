import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { customerFetch, CustomerApiError } from './customer';

// Mock the auth module
vi.mock('./auth', () => ({
  getAccessToken: vi.fn(() => 'test-access-token'),
  getCustomerApiUrl: vi.fn(
    () => 'https://shopify.com/lunettiq/account/customer/api/2024-10/graphql'
  ),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('customerFetch', () => {
  it('sends correct headers with bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { customer: { id: '1' } } }),
    } as Response);

    await customerFetch('query { customer { id } }');

    expect(fetch).toHaveBeenCalledWith(
      'https://shopify.com/lunettiq/account/customer/api/2024-10/graphql',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token',
        },
        body: JSON.stringify({ query: 'query { customer { id } }' }),
      }
    );
  });

  it('uses provided access token over cookie token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { customer: { id: '1' } } }),
    } as Response);

    await customerFetch('query { customer { id } }', undefined, 'explicit-token');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer explicit-token',
        }),
      })
    );
  });

  it('returns data on successful response', async () => {
    const mockData = { customer: { id: '1', firstName: 'Jane' } };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockData }),
    } as Response);

    const result = await customerFetch<typeof mockData>('query { customer { id firstName } }');
    expect(result).toEqual(mockData);
  });

  it('throws CustomerApiError when no access token is available', async () => {
    // Override the mock to return null
    const authModule = await import('./auth');
    vi.mocked(authModule.getAccessToken).mockReturnValueOnce(null);

    await expect(
      customerFetch('query { customer { id } }')
    ).rejects.toThrow('No access token available');
  });

  it('throws CustomerApiError on non-OK HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    await expect(customerFetch('query { customer { id } }')).rejects.toThrow(
      CustomerApiError
    );
  });

  it('throws CustomerApiError on GraphQL errors in response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: null,
        errors: [{ message: 'Access denied' }],
      }),
    } as Response);

    try {
      await customerFetch('query { customer { id } }');
    } catch (err) {
      const error = err as CustomerApiError;
      expect(error).toBeInstanceOf(CustomerApiError);
      expect(error.status).toBe(200);
      expect(error.graphqlErrors).toEqual([{ message: 'Access denied' }]);
    }
  });

  it('passes variables in the request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { customer: {} } }),
    } as Response);

    const variables = { namespace: 'custom', key: 'wishlist' };
    await customerFetch('query ($namespace: String!) { ... }', variables);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          query: 'query ($namespace: String!) { ... }',
          variables,
        }),
      })
    );
  });
});
