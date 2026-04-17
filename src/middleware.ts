import { NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

const ACCESS_TOKEN_COOKIE = 'lunettiq_access_token';
const REFRESH_TOKEN_COOKIE = 'lunettiq_refresh_token';

function getShopId(): string {
  return process.env.SHOPIFY_STORE_ID || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!.replace('.myshopify.com', '');
}

function getTokenUrl(): string {
  return `https://shopify.com/${getShopId()}/auth/oauth/token`;
}

async function tryRefreshToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID!,
      refresh_token: refreshToken,
    });
    const secret = process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET;
    if (secret) body.set('client_secret', secret);
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

async function handleAccountAuth(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (accessToken) return NextResponse.next();

  if (refreshToken) {
    const tokens = await tryRefreshToken(refreshToken);
    if (tokens) {
      const response = NextResponse.next();
      const opts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
      };
      response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.access_token, { ...opts, maxAge: 3600 });
      response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, { ...opts, maxAge: 30 * 24 * 3600 });
      return response;
    }
  }

  return NextResponse.redirect(new URL('/api/auth/login', request.url));
}

// Clerk middleware handles /crm routes, passes through everything else
export default clerkMiddleware(async (_auth, request) => {
  const { pathname } = request.nextUrl;

    // Skip auth API routes entirely
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    // Storefront account routes — Shopify Customer Accounts auth
  if (pathname.startsWith('/account')) {
    return handleAccountAuth(request);
  }

  // CRM routes — surface identification for audit logging
  if (pathname.startsWith('/crm') || pathname.startsWith('/api/crm')) {
    const surface = request.headers.get('x-crm-surface') ?? 'web';
    const response = NextResponse.next();
    response.headers.set('x-crm-surface', surface);
    return response;
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/account', '/account/:path*', '/crm/:path*', '/api/crm/:path*'],
};
