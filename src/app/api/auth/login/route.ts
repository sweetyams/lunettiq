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
import {
  generateRandomString,
  buildAuthorizeRedirectUrl,
  setOAuthStateCookies,
} from '@/lib/shopify/auth';

export async function GET() {
  const state = generateRandomString();
  const nonce = generateRandomString();

  setOAuthStateCookies(state, nonce);

  const authorizeUrl = await buildAuthorizeRedirectUrl(state, nonce);

  return NextResponse.redirect(authorizeUrl);
}
