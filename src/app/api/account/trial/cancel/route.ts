export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { membershipTrials, creditsLedger, customersProjection } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq, and } from 'drizzle-orm';
import { getCreditBalance } from '@/lib/crm/points';
import { updateCustomerMetafield } from '@/lib/crm/shopify-admin';

function extractId(gid: string) { return gid.replace(/^gid:\/\/shopify\/Customer\//, ''); }

async function requireCustomer() {
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) return process.env.DEV_CUSTOMER_ID;
  const token = getAccessToken();
  if (!token) throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return extractId((await getCustomerProfile(token)).id);
}

// POST /api/account/trial/cancel
export async function POST() {
  let customerId: string;
  try { customerId = await requireCustomer(); } catch (e) { if (e instanceof NextResponse) return e; return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const trial = await db.select().from(membershipTrials)
    .where(and(eq(membershipTrials.shopifyCustomerId, customerId), eq(membershipTrials.outcome, 'pending')))
    .then(r => r[0]);
  if (!trial) return NextResponse.json({ error: 'No active trial' }, { status: 400 });

  const used = Number(trial.creditsUsedDuringTrial ?? 0);
  const clawback = Math.round(used * 0.5 * 100) / 100; // 50% of used

  // Update trial
  await db.update(membershipTrials).set({
    outcome: clawback > 0 ? 'clawback_applied' : 'cancelled',
    cancelledAt: new Date(),
    clawbackAmount: clawback > 0 ? String(clawback) : null,
  }).where(eq(membershipTrials.id, trial.id));

  // Remove CULT tag
  const client = await db.select({ tags: customersProjection.tags }).from(customersProjection)
    .where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  const tags = (client?.tags ?? []).filter(t => t !== 'member-cult');
  await db.update(customersProjection).set({ tags }).where(eq(customersProjection.shopifyCustomerId, customerId));

  // Mark trial_used
  await updateCustomerMetafield(Number(customerId), 'custom', 'trial_used', 'true', 'boolean').catch(() => {});

  // Forfeit unused credits
  const creditBalance = await getCreditBalance(customerId);
  const issued = Number(trial.creditsIssuedAtStart ?? 0);
  const unused = issued - used;
  if (unused > 0) {
    await db.insert(creditsLedger).values({
      shopifyCustomerId: customerId, currency: 'credit',
      transactionType: 'membership_trial_cancelled', amount: String(-unused),
      runningBalance: String(creditBalance - unused), reason: `Trial cancelled — $${unused} unused credits forfeited`,
    });
  }

  return NextResponse.json({ data: { cancelled: true, clawback, unused } });
}
