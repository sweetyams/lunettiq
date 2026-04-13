import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storefrontFetch, setSleep, getRetryDelay } from './storefront';
import { StorefrontApiError, StorefrontRateLimitError } from './errors';

// Stub sleep to be instant during tests
const noopSleep = vi.fn(async () => {});

beforeEach(() => {
  noopSleep.mockClear();
  setSleep(noopSleep);
  vi.stubGlobal('fetch', vi.fn());
  vi.stubEnv('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN', 'test-store.myshopify.com');
  vi.stubEnv('SHOPIFY_STOREFRONT_ACCESS_TOKEN', 'test-token');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockFetchResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

describe('storefrontFetch', () => {
  it('returns data on a successful 200 response', async () => {
    const data = { products: [{ id: '1', title: 'Frame A' }] };
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, { data }) as Response);

    const result = await storefrontFetch<typeof data>('query { products { id title } }');
    expect(result).toEqual(data);
  });

  it('sends correct headers and body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(200, { data: {} }) as Response
    );

    const query = '{ shop { name } }';
    const variables = { first: 10 };
    await storefrontFetch(query, variables);

    expect(fetch).toHaveBeenCalledWith(
      'https://test-store.myshopify.com/api/2024-10/graphql.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Shopify-Storefront-Private-Token': 'test-token',
        },
        body: JSON.stringify({ query, variables }),
      }
    );
  });

  it('throws StorefrontApiError on GraphQL errors in response body', async () => {
    const body = {
      data: null,
      errors: [{ message: 'Field not found' }],
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, body) as Response);

    await expect(storefrontFetch('{ bad }')).rejects.toThrow(StorefrontApiError);
    await vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(200, body) as Response);

    try {
      await storefrontFetch('{ bad }');
    } catch (err) {
      const error = err as StorefrontApiError;
      expect(error.status).toBe(200);
      expect(error.graphqlErrors).toEqual([{ message: 'Field not found' }]);
    }
  });

  it('throws StorefrontApiError on non-retryable HTTP errors (e.g. 400)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockFetchResponse(400, { errors: [{ message: 'Bad request' }] }) as Response
    );

    await expect(storefrontFetch('{ bad }')).rejects.toThrow(StorefrontApiError);
    expect(fetch).toHaveBeenCalledTimes(1); // no retries
  });

  it('retries on 429 and succeeds on subsequent attempt', async () => {
    const data = { shop: { name: 'Lunettiq' } };
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockFetchResponse(429, {}) as Response)
      .mockResolvedValueOnce(mockFetchResponse(200, { data }) as Response);

    const result = await storefrontFetch<typeof data>('{ shop { name } }');
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(noopSleep).toHaveBeenCalledWith(500); // first retry delay
  });

  it('retries on 5xx and succeeds on subsequent attempt', async () => {
    const data = { shop: { name: 'Lunettiq' } };
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockFetchResponse(503, {}) as Response)
      .mockResolvedValueOnce(mockFetchResponse(200, { data }) as Response);

    const result = await storefrontFetch<typeof data>('{ shop { name } }');
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws StorefrontRateLimitError after max retries on 429', async () => {
    vi.mocked(fetch)
      .mockResolvedValue(mockFetchResponse(429, {}) as Response);

    await expect(storefrontFetch('{ shop { name } }')).rejects.toThrow(StorefrontRateLimitError);
    // initial + 3 retries = 4 calls
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('throws StorefrontApiError after max retries on 500', async () => {
    vi.mocked(fetch)
      .mockResolvedValue(mockFetchResponse(500, {}) as Response);

    await expect(storefrontFetch('{ shop { name } }')).rejects.toThrow(StorefrontApiError);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('uses exponential backoff delays between retries', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockFetchResponse(429, {}) as Response)
      .mockResolvedValueOnce(mockFetchResponse(429, {}) as Response)
      .mockResolvedValueOnce(mockFetchResponse(429, {}) as Response)
      .mockResolvedValueOnce(mockFetchResponse(429, {}) as Response);

    await expect(storefrontFetch('{ shop { name } }')).rejects.toThrow();

    expect(noopSleep).toHaveBeenCalledTimes(3);
    expect(noopSleep).toHaveBeenNthCalledWith(1, 500);
    expect(noopSleep).toHaveBeenNthCalledWith(2, 1000);
    expect(noopSleep).toHaveBeenNthCalledWith(3, 2000);
  });
});

describe('getRetryDelay', () => {
  it('returns exponentially increasing delays', () => {
    expect(getRetryDelay(0)).toBe(500);
    expect(getRetryDelay(1)).toBe(1000);
    expect(getRetryDelay(2)).toBe(2000);
  });
});
