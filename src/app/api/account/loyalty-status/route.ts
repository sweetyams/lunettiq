export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq } from 'drizzle-orm';
import { getTierFromTags } from '@/lib/crm/loyalty-config';

export async function GET() {
  let customerId: string | null = null;
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) { customerId = process.env.DEV_CUSTOMER_ID; }
  else {
    const token = getAccessToken();
    if (!token) return NextResponse.json({ data: { tier: null } });
    try { customerId = (await getCustomerProfile(token)).id.replace(/^gid:\/\/shopify\/Customer\//, ''); } catch { return NextResponse.json({ data: { tier: null } }); }
  }
  const client = await db.select({ tags: customersProjection.tags }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  return NextResponse.json({ data: { tier: getTierFromTags(client?.tags ?? null) } });
}
