export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { updateCustomer } from '@/lib/crm/shopify-admin';
import { eq } from 'drizzle-orm';

export async function PUT(request: NextRequest) {
  let customerId: string | null = null;
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) {
    customerId = process.env.DEV_CUSTOMER_ID;
  } else {
    const token = getAccessToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try { customerId = (await getCustomerProfile(token)).id.replace(/^gid:\/\/shopify\/Customer\//, ''); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  }

  const body = await request.json();
  const updates: Record<string, string> = {};
  if (body.firstName !== undefined) updates.first_name = body.firstName;
  if (body.lastName !== undefined) updates.last_name = body.lastName;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;

  // Write to Shopify
  if (Object.keys(updates).length) {
    await updateCustomer(Number(customerId), updates).catch(() => {});
  }

  // Update local projection
  await db.update(customersProjection).set({
    firstName: body.firstName ?? undefined,
    lastName: body.lastName ?? undefined,
    email: body.email ?? undefined,
    phone: body.phone ?? undefined,
    syncedAt: new Date(),
  }).where(eq(customersProjection.shopifyCustomerId, customerId));

  return NextResponse.json({ ok: true });
}
