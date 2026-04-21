export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';

/**
 * GET /api/account/me
 * Returns minimal customer identity for client-side tracking (PostHog identify).
 * Returns null if not logged in — no error, just empty.
 */
export async function GET() {
  try {
    const token = getAccessToken();
    if (!token) return NextResponse.json({ data: null });

    const profile = await getCustomerProfile(token);
    const id = profile.id.replace(/^gid:\/\/shopify\/Customer\//, '');

    return NextResponse.json({
      data: {
        id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      },
    });
  } catch {
    return NextResponse.json({ data: null });
  }
}
