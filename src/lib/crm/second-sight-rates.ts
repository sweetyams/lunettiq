import { loadTiers, getTierFromTags } from '@/lib/crm/loyalty-config';

// V2 rates: non-member 10%, Essential 15%, CULT 30%, VAULT 35%
const NON_MEMBER_RATE = 0.10;

const GRADE_MULTIPLIERS: Record<string, number> = {
  A: 0.50,
  B: 0.35,
  C: 0.075, // 5-10% average
  D: 0,
};

export async function calculateTradeInCredit(opts: {
  frameMsrp: number;
  grade: string;
  customerTags: string[] | null;
}): Promise<{ rate: number; gradeMultiplier: number; credit: number; tier: string | null }> {
  const tier = getTierFromTags(opts.customerTags);
  let rate = NON_MEMBER_RATE;

  if (tier) {
    const tiers = await loadTiers();
    const config = tiers.find(t => t.id === tier);
    rate = config?.tradeInRate ?? NON_MEMBER_RATE;
  }

  const gradeMultiplier = GRADE_MULTIPLIERS[opts.grade] ?? 0;
  const credit = Math.round(opts.frameMsrp * rate * gradeMultiplier * 100) / 100;

  return { rate, gradeMultiplier, credit, tier };
}

export function getTradeInRates(): { tier: string; rate: number }[] {
  return [
    { tier: 'Non-member', rate: NON_MEMBER_RATE },
    { tier: 'Essential', rate: 0.15 },
    { tier: 'CULT', rate: 0.30 },
    { tier: 'VAULT', rate: 0.35 },
  ];
}
