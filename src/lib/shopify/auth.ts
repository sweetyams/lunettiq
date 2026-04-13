/**
 * Shopify Customer Account API OAuth helpers.
 *
 * Provides utility functions for the OAuth flow: building authorize URLs,
 * exchanging codes for tokens, refreshing tokens, and cookie management.
 *
 * Requirements: 22.1, 22.2, 22.4, 22.5, 22.6
 */

import { cookies } from 'next/headers';

// Cookie names
export const ACCESS_TOKEN_COOKIE = 'lunettiq_access_token';
export const REFRESH_TOKEN_COOKIE = 'lunettiq_refresh_token';
const STATE_COOKIE = 'lunettiq_oauth_state';
const NONCE_COOKIE = 'lunettiq_oauth_nonce';

// Cookie max ages (seconds)
const ACCESS_TOKEN_MAX_AGE = 3600; // 1 hour
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 3600; // 30 days

function getShopId(): string {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
  // Extract shop name from domain (e.g., "my-store" from "my-store.myshopify.com")
  return domain.replace('.myshopify.com', '');
}

function getClientId(): string {
  return process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID!;
}

function getClientSecret(): string {
  return process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET!;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function getAuthorizeUrl(): string {
  return `https://shopify.com/${getShopId()}/auth/oauth/authorize`;
}

export function getTokenUrl(): string {
  return `https://shopify.com/${getShopId()}/auth/oauth/token`;
}

export function getCustomerApiUrl(): string {
  return `https://shopify.com/${getShopId()}/account/customer/api/2024-10/graphql`;
}

/**
 * Generate a cryptographically random string for OAuth state/nonce.
 */
export function generateRandomString(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the full Shopify OAuth authorize redirect URL.
 */
export function buildAuthorizeRedirectUrl(state: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: `${getBaseUrl()}/api/auth/callback`,
    scope: 'openid email customer-account-api:full',
    state,
    nonce,
  });

  return `${getAuthorizeUrl()}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
}> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: `${getBaseUrl()}/api/auth/callback`,
    code,
  });

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
  });

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed (${response.status})`);
  }

  return response.json();
}

/**
 * Store OAuth state and nonce in cookies for CSRF protection.
 */
export function setOAuthStateCookies(state: string, nonce: string): void {
  const cookieStore = cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 300, // 5 minutes
  };

  cookieStore.set(STATE_COOKIE, state, options);
  cookieStore.set(NONCE_COOKIE, nonce, options);
}

/**
 * Retrieve and clear OAuth state cookie. Returns null if not found.
 */
export function getAndClearOAuthState(): string | null {
  const cookieStore = cookies();
  const state = cookieStore.get(STATE_COOKIE)?.value ?? null;
  if (state) {
    cookieStore.delete(STATE_COOKIE);
    cookieStore.delete(NONCE_COOKIE);
  }
  return state;
}

/**
 * Store access and refresh tokens in secure HTTP-only cookies.
 */
export function setAuthTokenCookies(accessToken: string, refreshToken: string): void {
  const cookieStore = cookies();
  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

/**
 * Clear all auth-related cookies (logout).
 */
export function clearAuthCookies(): void {
  const cookieStore = cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(NONCE_COOKIE);
}

/**
 * Get the current access token from cookies, or null if not present.
 */
export function getAccessToken(): string | null {
  const cookieStore = cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

/**
 * Get the current refresh token from cookies, or null if not present.
 */
export function getRefreshToken(): string | null {
  const cookieStore = cookies();
  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}
