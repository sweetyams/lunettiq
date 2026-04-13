/**
 * GET /api/auth/logout
 *
 * Clears all auth cookies and redirects to the homepage.
 *
 * Requirements: 22.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/shopify/auth';

export async function GET(request: NextRequest) {
  clearAuthCookies();

  return NextResponse.redirect(`${request.nextUrl.origin}/`);
}
