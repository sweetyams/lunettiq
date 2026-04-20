export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { giftMemberships, customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq } from 'drizzle-orm';
import { TIERS } from '@/lib/crm/loyalty-config';

function extractId(gid: string) { return gid.replace(/^gid:\/\/shopify\/Customer\//, ''); }

export async function POST(request: NextRequest) {
  let customerId: string;
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) { customerId = process.env.DEV_CUSTOMER_ID; }
  else {
    const token = getAccessToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    customerId = extractId((await getCustomerProfile(token)).id);
  }

  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const gift = await db.select().from(giftMemberships).where(eq(giftMemberships.code, code)).then(r => r[0]);
  if (!gift) return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
  if (gift.status === 'redeemed') return NextResponse.json({ error: 'Already redeemed' }, { status: 400 });
  if (gift.expiresAt && new Date(gift.expiresAt) < new Date()) return NextResponse.json({ error: 'Expired' }, { status: 400 });

  // Apply tier tag
  const tierConfig = TIERS[gift.tier as keyof typeof TIERS];
  if (!tierConfig) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });

  const client = await db.select({ tags: customersProjection.tags }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  const tags = [...(client?.tags ?? []).filter(t => !t.startsWith('member-')), tierConfig.tag];
  await db.update(customersProjection).set({ tags }).where(eq(customersProjection.shopifyCustomerId, customerId));

  // Mark redeemed
  await db.update(giftMemberships).set({ status: 'redeemed', redeemedAt: new Date(), recipientCustomerId: customerId }).where(eq(giftMemberships.id, gift.id));

  // Set member_since metafield
  const { updateCustomerMetafield } = await import('@/lib/crm/shopify-admin');
  await updateCustomerMetafield(Number(customerId), 'custom', 'member_since', new Date().toISOString().slice(0, 10), 'date').catch(() => {});

  return NextResponse.json({ data: { tier: gift.tier, durationMonths: gift.durationMonths } });
}
