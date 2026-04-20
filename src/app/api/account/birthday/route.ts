export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { updateCustomerMetafield } from '@/lib/crm/shopify-admin';
import { eq } from 'drizzle-orm';

async function getCustomerId() {
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) return process.env.DEV_CUSTOMER_ID;
  const token = getAccessToken();
  if (!token) return null;
  return (await getCustomerProfile(token)).id.replace(/^gid:\/\/shopify\/Customer\//, '');
}

export async function POST(request: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { birthday } = await request.json(); // format: "YYYY-MM-DD"
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
  }

  // Save to Shopify metafield
  await updateCustomerMetafield(Number(customerId), 'custom', 'birthday', birthday, 'date').catch(() => {});

  // Save to local DB
  const client = await db.select({ metafields: customersProjection.metafields })
    .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  const mf = (client?.metafields ?? {}) as any;
  if (!mf.custom) mf.custom = {};
  mf.custom.birthday = birthday;
  await db.update(customersProjection).set({ metafields: mf }).where(eq(customersProjection.shopifyCustomerId, customerId));

  return NextResponse.json({ data: { birthday } });
}
