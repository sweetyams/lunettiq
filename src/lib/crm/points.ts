import { db } from '@/lib/db';
import { creditsLedger } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

const POINTS_PER_DOLLAR = 5; // 100 pts = $5

export function pointsToDollars(pts: number): number {
  return Math.floor(pts / 100) * POINTS_PER_DOLLAR;
}

export function dollarsToPoints(dollars: number): number {
  return Math.round((dollars / POINTS_PER_DOLLAR) * 100);
}

export async function getPointsBalance(customerId: string): Promise<number> {
  const r = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
    .from(creditsLedger)
    .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'points')));
  return Math.round(Number(r[0]?.total ?? 0));
}

export async function getCreditBalance(customerId: string): Promise<number> {
  const r = await db.select({ total: sql<string>`coalesce(sum(amount::numeric), 0)` })
    .from(creditsLedger)
    .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'credit')));
  return Number(r[0]?.total ?? 0);
}

export async function issuePoints(opts: {
  customerId: string;
  amount: number;
  type: string;
  reason: string;
  relatedOrderId?: string;
  relatedReferralId?: string;
  expiresInMonths?: number;
}) {
  const balance = await getPointsBalance(opts.customerId);
  const expiresAt = opts.expiresInMonths
    ? new Date(Date.now() + opts.expiresInMonths * 30 * 86400000)
    : new Date(Date.now() + 18 * 30 * 86400000); // default 18 months

  await db.insert(creditsLedger).values({
    shopifyCustomerId: opts.customerId,
    currency: 'points',
    transactionType: opts.type as any,
    amount: String(opts.amount),
    runningBalance: String(balance + opts.amount),
    reason: opts.reason,
    relatedOrderId: opts.relatedOrderId ?? null,
    relatedReferralId: opts.relatedReferralId ?? null,
    expiresAt,
  });
}

export async function redeemPoints(opts: {
  customerId: string;
  points: number;
  orderId: string;
}): Promise<{ ok: boolean; dollars: number; error?: string }> {
  const balance = await getPointsBalance(opts.customerId);
  if (opts.points > balance) return { ok: false, dollars: 0, error: 'Insufficient points' };
  if (opts.points < 200) return { ok: false, dollars: 0, error: 'Minimum 200 points' };

  const dollars = pointsToDollars(opts.points);
  await db.insert(creditsLedger).values({
    shopifyCustomerId: opts.customerId,
    currency: 'points',
    transactionType: 'points_redeemed_order',
    amount: String(-opts.points),
    runningBalance: String(balance - opts.points),
    reason: `Redeemed ${opts.points} pts for $${dollars} on order`,
    relatedOrderId: opts.orderId,
  });

  return { ok: true, dollars };
}
