export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { giftMemberships, customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

function extractId(gid: string) { return gid.replace(/^gid:\/\/shopify\/Customer\//, ''); }
async function getCustomerId() {
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) return process.env.DEV_CUSTOMER_ID;
  const token = getAccessToken();
  if (!token) return null;
  return extractId((await getCustomerProfile(token)).id);
}

export async function POST(request: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { tier, durationMonths, recipientEmail, message } = await request.json();
  if (!tier || !recipientEmail) return NextResponse.json({ error: 'tier and recipientEmail required' }, { status: 400 });

  const code = randomBytes(6).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 365 * 86400000);
  const [row] = await db.insert(giftMemberships).values({
    code, purchaserCustomerId: customerId, recipientEmail, tier,
    durationMonths: durationMonths ?? 12, expiresAt, message: message ?? null,
  }).returning();

  const { fireKlaviyoEvent } = await import('@/lib/klaviyo/events');
  const p = await db.select({ firstName: customersProjection.firstName }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  await fireKlaviyoEvent(recipientEmail, 'Gift Membership', { code, tier, from_name: p?.firstName ?? 'A friend', message: message ?? '' });
  return NextResponse.json({ data: row }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
  const gift = await db.select().from(giftMemberships).where(eq(giftMemberships.code, code)).then(r => r[0]);
  if (!gift) return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
  if (gift.status === 'redeemed') return NextResponse.json({ error: 'Already redeemed' }, { status: 400 });
  if (gift.expiresAt && new Date(gift.expiresAt) < new Date()) return NextResponse.json({ error: 'Expired' }, { status: 400 });
  return NextResponse.json({ data: { tier: gift.tier, durationMonths: gift.durationMonths, message: gift.message } });
}
