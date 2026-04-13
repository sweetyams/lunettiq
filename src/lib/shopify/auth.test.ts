import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateRandomString,
  buildAuthorizeRedirectUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getAuthorizeUrl,
  getTokenUrl,
  getCustomerApiUrl,
} from './auth';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN', 'lunettiq.myshopify.com');
  vi.stubEnv('SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID', 'test-client-id');
  vi.stubEnv('SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET', 'test-client-secret');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://lunettiq.com');
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Mock next/headers cookies
vi.mock('next/headers', () => {
  const cookieStore = new Map<string, string>();
  return {
    cookies: () => ({
      get: (name: string) => {
        const value = cookieStore.get(name);
        return value ? { value } : undefined;
      },
      set: (name: string, value: string) => {
        cookieStore.set(name, value);
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      },
      _store: cookieStore,
    }),
  };
});

describe('generateRandomString', () => {
  it('generates a string of the expected length', () => {
    const result = generateRandomString(16);
    // 16 bytes → 32 hex chars
    expect(result).toHaveLength(32);
  });

  it('generates unique strings on successive calls', () => {
    const a = generateRandomString();
    const b = generateRandomString();
    expect(a).not.toBe(b);
  });

  it('generates only hex characters', () => {
    const result = generateRandomString();
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});

describe('URL builders', () => {
  it('builds the correct authorize URL', () => {
    expect(getAuthorizeUrl()).toBe(
      'https://shopify.com/lunettiq/auth/oauth/authorize'
    );
  });

  it('builds the correct token URL', () => {
    expect(getTokenUrl()).toBe(
      'https://shopify.com/lunettiq/auth/oauth/token'
    );
  });

  it('builds the correct Customer API URL', () => {
    expect(getCustomerApiUrl()).toBe(
      'https://shopify.com/lunettiq/account/customer/api/2024-10/graphql'
    );
  });
});

describe('buildAuthorizeRedirectUrl', () => {
  it('includes all required OAuth parameters', () => {
    const url = buildAuthorizeRedirectUrl('test-state', 'test-nonce');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      'https://shopify.com/lunettiq/auth/oauth/authorize'
    );
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://lunettiq.com/api/auth/callback'
    );
    expect(parsed.searchParams.get('scope')).toBe(
      'openid email customer-account-api:full'
    );
    expect(parsed.searchParams.get('state')).toBe('test-state');
    expect(parsed.searchParams.get('nonce')).toBe('test-nonce');
  });
});

describe('exchangeCodeForTokens', () => {
  it('sends correct request and returns tokens on success', async () => {
    const mockTokens = {
      access_token: 'access-123',
      refresh_token: 'refresh-456',
      expires_in: 3600,
      id_token: 'id-789',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokens,
    } as Response);

    const result = await exchangeCodeForTokens('auth-code-xyz');

    expect(result).toEqual(mockTokens);
    expect(fetch).toHaveBeenCalledWith(
      'https://shopify.com/lunettiq/auth/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );

    // Verify the body contains the correct params
    const callArgs = vi.mocked(fetch).mock.calls[0];
    const body = new URLSearchParams(callArgs[1]?.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('client_secret')).toBe('test-client-secret');
    expect(body.get('code')).toBe('auth-code-xyz');
    expect(body.get('redirect_uri')).toBe('https://lunettiq.com/api/auth/callback');
  });

  it('throws on failed token exchange', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
    } as Response);

    await expect(exchangeCodeForTokens('bad-code')).rejects.toThrow(
      'Token exchange failed (400)'
    );
  });
});

describe('refreshAccessToken', () => {
  it('sends correct request and returns new tokens', async () => {
    const mockTokens = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokens,
    } as Response);

    const result = await refreshAccessToken('old-refresh-token');

    expect(result).toEqual(mockTokens);

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const body = new URLSearchParams(callArgs[1]?.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('old-refresh-token');
  });

  it('throws on failed refresh', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    await expect(refreshAccessToken('expired-token')).rejects.toThrow(
      'Token refresh failed (401)'
    );
  });
});
