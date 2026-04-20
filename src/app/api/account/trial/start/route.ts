export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { membershipTrials, creditsLedger, customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq, and, sql } from 'drizzle-orm';
import { getPointsBalance, getCreditBalance } from '@/lib/crm/points';
import { getTierFromTags } from '@/lib/crm/loyalty-config';

function extractId(gid: string) { return gid.replace(/^gid:\/\/shopify\/Customer\//, ''); }

async function requireCustomer() {
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) return process.env.DEV_CUSTOMER_ID;
  const token = getAccessToken();
  if (!token) throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return extractId((await getCustomerProfile(token)).id);
}

// POST /api/account/trial/start
export async function POST(request: NextRequest) {
  let customerId: string;
  try { customerId = await requireCustomer(); } catch (e) { if (e instanceof NextResponse) return e; return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  // Check eligibility
  const client = await db.select({ tags: customersProjection.tags, metafields: customersProjection.metafields })
    .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  if (!client) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const meta = ((client.metafields as any)?.custom ?? {}) as Record<string, string>;
  if (meta.trial_used === 'true') return NextResponse.json({ error: 'Trial already used' }, { status: 400 });

  const tier = getTierFromTags(client.tags);
  if (tier) return NextResponse.json({ error: 'Already a member' }, { status: 400 });

  // Check: 500+ points OR recent purchase >$250 (simplified: just check points for now)
  const points = await getPointsBalance(customerId);
  if (points < 500) return NextResponse.json({ error: 'Need 500+ points to start trial' }, { status: 400 });

  // Create trial
  const convertsAt = new Date(Date.now() + 31 * 86400000);
  const creditAmount = 25; // CULT monthly credit

  const [trial] = await db.insert(membershipTrials).values({
    shopifyCustomerId: customerId,
    tier: 'cult',
    creditsIssuedAtStart: String(creditAmount),
    convertsAt,
  }).returning();

  // Issue trial credits
  const creditBalance = await getCreditBalance(customerId);
  await db.insert(creditsLedger).values({
    shopifyCustomerId: customerId, currency: 'credit',
    transactionType: 'membership_trial_started', amount: String(creditAmount),
    runningBalance: String(creditBalance + creditAmount), reason: 'CULT trial — 30-day free credits',
  });

  // Apply CULT tag
  const tags = [...(client.tags ?? []), 'member-cult'];
  await db.update(customersProjection).set({ tags }).where(eq(customersProjection.shopifyCustomerId, customerId));

  return NextResponse.json({ data: trial }, { status: 201 });
}
