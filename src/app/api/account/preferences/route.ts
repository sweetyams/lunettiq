export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/shopify/auth';
import { setCustomerMetafield } from '@/lib/shopify/customer';

export async function PUT(request: NextRequest) {
  const token = getAccessToken();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  await setCustomerMetafield('custom', 'preferences_json', body, 'json', token);
  return NextResponse.json({ ok: true });
}
