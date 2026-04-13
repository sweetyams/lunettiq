import { StorefrontApiError, StorefrontRateLimitError } from './errors';

function getApiUrl(): string {
  return `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN}/api/2024-10/graphql.json`;
}

function getAccessToken(): string {
  return process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN!;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

/**
 * Determines whether a response status code is retryable (429 or 5xx).
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Returns the delay in ms for a given retry attempt using exponential backoff.
 * attempt 0 → 500ms, attempt 1 → 1000ms, attempt 2 → 2000ms
 */
export function getRetryDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Sleeps for the given number of milliseconds.
 * Extracted to allow test overrides.
 */
export let sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Replace the sleep implementation (useful for testing).
 */
export function setSleep(fn: (ms: number) => Promise<void>): void {
  sleep = fn;
}

/**
 * Executes a GraphQL query against the Shopify Storefront API.
 *
 * - Retries on 429 and 5xx responses with exponential backoff (max 3 retries).
 * - Throws StorefrontRateLimitError after exhausting retries on 429.
 * - Throws StorefrontApiError for non-retryable failures or exhausted retries on 5xx.
 * - Throws StorefrontApiError when the response body contains GraphQL errors.
 *
 * Requirements: 27.1, 27.3, 27.5, 30.4
 */
export async function storefrontFetch<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(getRetryDelay(attempt - 1));
    }

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Shopify-Storefront-Private-Token': getAccessToken(),
      },
      body: JSON.stringify({ query, variables }),
    });

    lastStatus = response.status;

    if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
      continue;
    }

    if (isRetryableStatus(response.status)) {
      // Exhausted all retries
      if (response.status === 429) {
        throw new StorefrontRateLimitError(
          `Storefront API rate limited after ${MAX_RETRIES} retries`,
          MAX_RETRIES
        );
      }
      throw new StorefrontApiError(
        `Storefront API server error (${response.status}) after ${MAX_RETRIES} retries`,
        response.status
      );
    }

    if (!response.ok) {
      throw new StorefrontApiError(
        `Storefront API request failed with status ${response.status}`,
        response.status
      );
    }

    const json = await response.json();

    if (json.errors && json.errors.length > 0) {
      throw new StorefrontApiError(
        `Storefront API GraphQL errors: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`,
        200,
        json.errors
      );
    }

    return json.data as T;
  }

  // This should be unreachable, but satisfies TypeScript
  throw new StorefrontApiError(
    `Storefront API request failed with status ${lastStatus}`,
    lastStatus
  );
}
