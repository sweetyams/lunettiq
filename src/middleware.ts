/**
 * Next.js Middleware
 *
 * Intercepts /account/* routes to verify authentication.
 * - If no access token cookie → redirect to /api/auth/login
 * - If access token is present → allow request through
 * - Token refresh is handled by checking the refresh token when access token is missing
 *
 * Requirements: 22.3, 22.4
 */

import { NextRequest, NextResponse } from 'next/server';

const ACCESS_TOKEN_COOKIE = 'lunettiq_access_token';
const REFRESH_TOKEN_COOKIE = 'lunettiq_refresh_token';

function getShopId(): string {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
  return domain.replace('.myshopify.com', '');
}

function getTokenUrl(): string {
  return `https://shopify.com/${getShopId()}/auth/oauth/token`;
}

/**
 * Attempt to refresh the access token using the refresh token.
 * Returns new tokens on success, null on failure.
 */
async function tryRefreshToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET!,
      refresh_token: refreshToken,
    });

    const response = await fetch(getTokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) return null;

    return response.json();
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /account routes
  if (!pathname.startsWith('/account')) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // Has a valid access token — allow through
  if (accessToken) {
    return NextResponse.next();
  }

  // No access token but has refresh token — attempt refresh
  if (refreshToken) {
    const tokens = await tryRefreshToken(refreshToken);

    if (tokens) {
      // Set new tokens in cookies and allow the request through
      const response = NextResponse.next();
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
      };

      response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
        ...cookieOptions,
        maxAge: 3600, // 1 hour
      });

      response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 3600, // 30 days
      });

      return response;
    }
  }

  // No valid tokens — redirect to login
  const loginUrl = new URL('/api/auth/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/account/:path*'],
};
