export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creditsLedger } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getPointsBalance, redeemPoints } from '@/lib/crm/points';

function extractId(gid: string) { return gid.replace(/^gid:\/\/shopify\/Customer\//, ''); }

async function requireCustomer() {
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) return process.env.DEV_CUSTOMER_ID;
  const token = getAccessToken();
  if (!token) throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await getCustomerProfile(token);
  return extractId(profile.id);
}

export async function GET() {
  let customerId;
  try { customerId = await requireCustomer(); } catch (e) { if (e instanceof NextResponse) return e; return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const [balance, history] = await Promise.all([
    getPointsBalance(customerId),
    db.select().from(creditsLedger)
      .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'points')))
      .orderBy(desc(creditsLedger.occurredAt)).limit(30),
  ]);

  // Find nearest expiry
  const nextExpiry = await db.select({ expiresAt: creditsLedger.expiresAt, amount: creditsLedger.amount })
    .from(creditsLedger)
    .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'points'), sql`amount::numeric > 0`, sql`expires_at IS NOT NULL AND expires_at > now()`))
    .orderBy(creditsLedger.expiresAt).limit(1).then(r => r[0]);

  return NextResponse.json({ data: { balance, history, nextExpiry: nextExpiry ? { date: nextExpiry.expiresAt, points: Number(nextExpiry.amount) } : null } });
}

export async function POST(request: NextRequest) {
  let customerId;
  try { customerId = await requireCustomer(); } catch (e) { if (e instanceof NextResponse) return e; return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { points, orderId } = await request.json();
  const result = await redeemPoints({ customerId, points, orderId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ data: result });
}
