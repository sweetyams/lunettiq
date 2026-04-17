/**
 * GET /api/auth/callback
 *
 * Handles the OAuth callback from Shopify. Verifies the state parameter,
 * exchanges the authorization code for tokens, stores tokens in HTTP-only
 * cookies, and redirects to /account.
 *
 * Requirements: 22.2, 22.4, 22.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getAndClearOAuthState,
  exchangeCodeForTokens,
  setAuthTokenCookies,
} from '@/lib/shopify/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/`);
  }

  // Get verifier from cookie
  const cookieStore = cookies();
  const verifier = cookieStore.get('lunettiq_oauth_verifier')?.value;
  cookieStore.delete('lunettiq_oauth_verifier');

  try {
    const tokens = await exchangeCodeForTokens(code, verifier);
    setAuthTokenCookies(tokens.access_token, tokens.refresh_token);
    return NextResponse.redirect(`${baseUrl}/account`);
  } catch (err) {
    console.error('[auth/callback] Token exchange failed:', err);
    return NextResponse.redirect(`${baseUrl}/?auth_error=1`);
  }
}
