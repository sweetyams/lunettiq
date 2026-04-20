export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq } from 'drizzle-orm';
import { getPointsBalance, issuePoints } from '@/lib/crm/points';
import { TIERS, getTierFromTags } from '@/lib/crm/loyalty-config';
import { updateCustomerMetafield } from '@/lib/crm/shopify-admin';
import { creditsLedger } from '@/lib/db/schema';
import { desc, and } from 'drizzle-orm';

function extractId(gid: string) { return gid.replace(/^gid:\/\/shopify\/Customer\//, ''); }

const MEMBERSHIP_CONVERSIONS: Record<string, { points: number; tier: string; months: number; label: string }> = {
  cult_1mo: { points: 4000, tier: 'cult', months: 1, label: '1 month CULT' },
  essential_3mo: { points: 8000, tier: 'essential', months: 3, label: '3 months Essential' },
  essential_1yr: { points: 20000, tier: 'essential', months: 12, label: '1 year Essential' },
  cult_1yr: { points: 40000, tier: 'cult', months: 12, label: '1 year CULT' },
};

const CREDIT_CONVERSIONS: Record<string, { points: number; credit: number; label: string }> = {
  credit_5: { points: 100, credit: 5, label: '$5 credit' },
  credit_10: { points: 200, credit: 10, label: '$10 credit' },
  credit_25: { points: 500, credit: 25, label: '$25 credit' },
  credit_50: { points: 1000, credit: 50, label: '$50 credit' },
};

export async function GET() {
  return NextResponse.json({ data: {
    credit: Object.entries(CREDIT_CONVERSIONS).map(([id, c]) => ({ id, type: 'credit', ...c })),
    membership: Object.entries(MEMBERSHIP_CONVERSIONS).map(([id, c]) => ({ id, type: 'membership', ...c })),
  }});
}

export async function POST(request: NextRequest) {
  let customerId: string;
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) { customerId = process.env.DEV_CUSTOMER_ID; }
  else {
    const token = getAccessToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    customerId = extractId((await getCustomerProfile(token)).id);
  }

  const { conversionId } = await request.json();

  // Credit conversion
  const creditConv = CREDIT_CONVERSIONS[conversionId];
  if (creditConv) {
    const balance = await getPointsBalance(customerId);
    if (balance < creditConv.points) return NextResponse.json({ error: `Need ${creditConv.points} points, have ${balance}` }, { status: 400 });

    // Deduct points
    await issuePoints({ customerId, amount: -creditConv.points, type: 'points_redeemed_order', reason: `Converted to ${creditConv.label}` });

    // Add to credit balance
    const lastCredit = await db.select({ bal: creditsLedger.runningBalance }).from(creditsLedger)
      .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'credit')))
      .orderBy(desc(creditsLedger.createdAt)).limit(1).then(r => r[0]);
    const currentBal = Number(lastCredit?.bal ?? 0);

    await db.insert(creditsLedger).values({
      shopifyCustomerId: customerId, currency: 'credit', transactionType: 'issued_manual',
      amount: String(creditConv.credit), runningBalance: String(currentBal + creditConv.credit),
      reason: `Points conversion: ${creditConv.points} pts → $${creditConv.credit}`,
    });

    return NextResponse.json({ data: { type: 'credit', credit: creditConv.credit, pointsSpent: creditConv.points, newBalance: balance - creditConv.points } });
  }

  // Membership conversion
  const conv = MEMBERSHIP_CONVERSIONS[conversionId];
  if (!conv) return NextResponse.json({ error: 'Invalid conversion' }, { status: 400 });

  const balance = await getPointsBalance(customerId);
  if (balance < conv.points) return NextResponse.json({ error: `Need ${conv.points} points, have ${balance}` }, { status: 400 });

  // Deduct points
  await issuePoints({ customerId, amount: -conv.points, type: 'points_redeemed_membership_conversion', reason: `Converted to ${conv.label}` });

  // Apply tier
  const tierConfig = TIERS[conv.tier as keyof typeof TIERS];
  const client = await db.select({ tags: customersProjection.tags }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  const tags = [...(client?.tags ?? []).filter(t => !t.startsWith('member-')), tierConfig.tag];
  await db.update(customersProjection).set({ tags }).where(eq(customersProjection.shopifyCustomerId, customerId));
  await updateCustomerMetafield(Number(customerId), 'custom', 'member_since', new Date().toISOString().slice(0, 10), 'date').catch(() => {});

  return NextResponse.json({ data: { tier: conv.tier, months: conv.months, pointsSpent: conv.points } });
}
