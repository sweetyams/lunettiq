export const TIERS = {
  essential: { tag: 'member-essential', label: 'Essential', monthlyCredit: 15, birthdayCredit: 20, tradeInRate: 0.20, lensRefresh: false, frameRotation: null as string | null },
  cult:      { tag: 'member-cult',      label: 'CULT',      monthlyCredit: 30, birthdayCredit: 20, tradeInRate: 0.30, lensRefresh: true,  frameRotation: '25% off' as string | null },
  vault:     { tag: 'member-vault',     label: 'VAULT',     monthlyCredit: 60, birthdayCredit: 20, tradeInRate: 0.375, lensRefresh: true, frameRotation: 'Free swap' as string | null },
} as const;

export type TierKey = keyof typeof TIERS;

export function getTierFromTags(tags: string[] | null): TierKey | null {
  if (!tags) return null;
  for (const [key, config] of Object.entries(TIERS)) {
    if (tags.includes(config.tag)) return key as TierKey;
  }
  return null;
}

export function getTierConfig(tier: TierKey) {
  return TIERS[tier];
}
