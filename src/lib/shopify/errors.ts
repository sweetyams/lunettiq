/**
 * Base error class for Storefront API failures.
 */
export class StorefrontApiError extends Error {
  public readonly status: number;
  public readonly graphqlErrors?: Array<{ message: string; locations?: unknown; path?: unknown }>;

  constructor(
    message: string,
    status: number,
    graphqlErrors?: Array<{ message: string; locations?: unknown; path?: unknown }>
  ) {
    super(message);
    this.name = 'StorefrontApiError';
    this.status = status;
    this.graphqlErrors = graphqlErrors;
  }
}

/**
 * Thrown when the Storefront API returns 429 (rate limited) after all retries are exhausted.
 */
export class StorefrontRateLimitError extends StorefrontApiError {
  public readonly retryCount: number;

  constructor(message: string, retryCount: number) {
    super(message, 429);
    this.name = 'StorefrontRateLimitError';
    this.retryCount = retryCount;
  }
}
