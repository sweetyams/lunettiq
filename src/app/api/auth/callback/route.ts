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

  const baseUrl = request.nextUrl.origin;

  // If the user cancelled or Shopify returned an error, redirect home silently (Req 22.6)
  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/`);
  }

  // Verify state matches what we stored
  const storedState = getAndClearOAuthState();
  if (!storedState || storedState !== state) {
    // State mismatch — possible CSRF. Redirect home silently (Req 22.6)
    return NextResponse.redirect(`${baseUrl}/`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    setAuthTokenCookies(tokens.access_token, tokens.refresh_token);

    return NextResponse.redirect(`${baseUrl}/account`);
  } catch {
    // Token exchange failed — redirect home silently (Req 22.6)
    return NextResponse.redirect(`${baseUrl}/`);
  }
}
