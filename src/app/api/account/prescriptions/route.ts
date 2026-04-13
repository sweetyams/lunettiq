import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerMetafield, setCustomerMetafield } from '@/lib/shopify/customer';
import type { PrescriptionRecord } from '@/types/customer';

export async function GET() {
  const token = getAccessToken();
  if (!token) {
    return NextResponse.json({ records: [] }, { status: 401 });
  }

  try {
    const data = await getCustomerMetafield<{ records: PrescriptionRecord[] }>(
      'custom',
      'prescriptions',
      token
    );
    return NextResponse.json(data ?? { records: [] });
  } catch {
    return NextResponse.json({ records: [] }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const records: PrescriptionRecord[] = body.records ?? [];
    await setCustomerMetafield('custom', 'prescriptions', { records }, 'json', token);
    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: 'Failed to update prescriptions' }, { status: 500 });
  }
}
