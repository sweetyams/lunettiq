/**
 * GET /api/auth/login
 *
 * Initiates the Shopify Customer Account API OAuth flow.
 * Generates state + nonce for CSRF protection, stores them in cookies,
 * and redirects the visitor to Shopify's authorize URL.
 *
 * Requirements: 22.1
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  generateRandomString,
  buildAuthorizeRedirectUrl,
  setOAuthStateCookies,
} from '@/lib/shopify/auth';

export async function GET() {
  const state = generateRandomString();
  const nonce = generateRandomString();

  setOAuthStateCookies(state, nonce);

  const { url, verifier } = await buildAuthorizeRedirectUrl(state, nonce);

  // Store verifier in cookie for token exchange
  const cookieStore = cookies();
  cookieStore.set('lunettiq_oauth_verifier', verifier, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 300 });

  return NextResponse.redirect(url);
}
