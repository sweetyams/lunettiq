import { db } from '@/lib/db';
import { referrals, creditsLedger, customersProjection } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { issuePoints } from './points';
import { updateCustomerMetafield } from './shopify-admin';

const MILESTONES = [
  { count: 3, reward: 'tier_upgrade_3mo', label: 'Tier upgrade for 3 months', pointsValue: 0 },
  { count: 5, reward: 'custom_engraving', label: 'Free custom engraving', pointsValue: 0 },
  { count: 10, reward: 'vault_event_invite', label: 'VAULT event invite', pointsValue: 0 },
];

export async function checkMilestones(customerId: string): Promise<string[]> {
  const qualifiedCount = await db.select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(eq(referrals.referrerCustomerId, customerId))
    .then(r => Number(r[0]?.count ?? 0));

  // Get already-awarded milestones from metafield
  const client = await db.select({ metafields: customersProjection.metafields })
    .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  const meta = ((client?.metafields as any)?.custom ?? {}) as Record<string, string>;
  const awarded = new Set((meta.milestones_awarded ?? '').split(',').filter(Boolean));

  const newRewards: string[] = [];
  for (const m of MILESTONES) {
    if (qualifiedCount >= m.count && !awarded.has(m.reward)) {
      awarded.add(m.reward);
      newRewards.push(m.reward);

      // Record in ledger as a milestone event
      if (m.pointsValue > 0) {
        await issuePoints({ customerId, amount: m.pointsValue, type: 'points_issued_milestone', reason: m.label });
      }
    }
  }

  if (newRewards.length > 0) {
    await updateCustomerMetafield(Number(customerId), 'custom', 'milestones_awarded', Array.from(awarded).join(','), 'single_line_text_field').catch(() => {});
  }

  return newRewards;
}

export async function getCustomerMilestones(customerId: string): Promise<{ milestone: typeof MILESTONES[number]; earned: boolean; qualifiedCount: number }[]> {
  const qualifiedCount = await db.select({ count: sql<number>`count(*)` })
    .from(referrals)
    .where(eq(referrals.referrerCustomerId, customerId))
    .then(r => Number(r[0]?.count ?? 0));

  const client = await db.select({ metafields: customersProjection.metafields })
    .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  const meta = ((client?.metafields as any)?.custom ?? {}) as Record<string, string>;
  const awarded = new Set((meta.milestones_awarded ?? '').split(',').filter(Boolean));

  return MILESTONES.map(m => ({ milestone: m, earned: awarded.has(m.reward) || qualifiedCount >= m.count, qualifiedCount }));
}

export function hasEngraving(metafields: any): boolean {
  const meta = (metafields?.custom ?? {}) as Record<string, string>;
  const awarded = (meta.milestones_awarded ?? '').split(',');
  const used = (meta.engraving_used ?? '') === 'true';
  return awarded.includes('custom_engraving') && !used;
}
