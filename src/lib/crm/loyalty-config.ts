// Hardcoded fallback (used if DB table is empty or on client side)
export const TIERS = {
  essential: {
    tag: 'member-essential', label: 'Essential',
    monthlyFee: 19, annualFee: 199,
    monthlyCredit: 12, birthdayCredit: 25, tradeInRate: 0.15,
    lensRefresh: false, frameRotation: null as string | null,
    shippingTier: 'standard' as string | null,
    earlyAccessHours: 24, namedOptician: false,
    freeRepairs: '1/yr' as string | null, styleConsultation: null as string | null,
    eventsPerYear: 0, annualGift: false, archiveVote: false, privateWhatsapp: false,
    referralRewardCredit: 30, referralExtensionMonths: 1,
    referredDiscount: 25, referredTrialTier: 'essential' as string | null,
  },
  cult: {
    tag: 'member-cult', label: 'CULT',
    monthlyFee: 39, annualFee: 399,
    monthlyCredit: 25, birthdayCredit: 25, tradeInRate: 0.30,
    lensRefresh: true, frameRotation: '25% off' as string | null,
    shippingTier: 'priority' as string | null,
    earlyAccessHours: 48, namedOptician: true,
    freeRepairs: 'unlimited' as string | null, styleConsultation: '30 min/yr' as string | null,
    eventsPerYear: 0, annualGift: false, archiveVote: false, privateWhatsapp: false,
    referralRewardCredit: 50, referralExtensionMonths: 1,
    referredDiscount: 25, referredTrialTier: 'cult' as string | null,
  },
  vault: {
    tag: 'member-vault', label: 'VAULT',
    monthlyFee: 79, annualFee: 799,
    monthlyCredit: 45, birthdayCredit: 50, tradeInRate: 0.35,
    lensRefresh: true, frameRotation: 'Free swap' as string | null,
    shippingTier: 'overnight' as string | null,
    earlyAccessHours: 96, namedOptician: true,
    freeRepairs: 'unlimited' as string | null, styleConsultation: 'unlimited' as string | null,
    eventsPerYear: 4, annualGift: true, archiveVote: true, privateWhatsapp: true,
    referralRewardCredit: 75, referralExtensionMonths: 0,
    referredDiscount: 40, referredTrialTier: 'cult' as string | null,
  },
} as const;

export type TierKey = string;

export interface TierConfig {
  id: string;
  tag: string;
  label: string;
  monthlyFee: number | null;
  annualFee: number | null;
  monthlyCredit: number;
  birthdayCredit: number;
  tradeInRate: number;
  lensRefresh: boolean;
  frameRotation: string | null;
  shippingTier: string | null;
  earlyAccessHours: number;
  namedOptician: boolean;
  freeRepairs: string | null;
  styleConsultation: string | null;
  eventsPerYear: number;
  annualGift: boolean;
  archiveVote: boolean;
  privateWhatsapp: boolean;
  referralRewardCredit: number | null;
  referralExtensionMonths: number;
  referredDiscount: number | null;
  referredTrialTier: string | null;
}

// Pure function — safe for client components
export function getTierFromTags(tags: string[] | null): string | null {
  if (!tags) return null;
  for (const [key, config] of Object.entries(TIERS)) {
    if (tags.includes(config.tag)) return key;
  }
  return null;
}

// Pure function — safe for client components
export function getTierConfig(tier: string): TierConfig | null {
  const t = TIERS[tier as keyof typeof TIERS];
  if (!t) return null;
  return { id: tier, ...t } as TierConfig;
}

// DB-dependent functions — only call from server components/API routes
let _cache: TierConfig[] | null = null;
let _cacheTime = 0;

export async function loadTiers(): Promise<TierConfig[]> {
  if (_cache && Date.now() - _cacheTime < 60000) return _cache;
  try {
    // Dynamic import to avoid pulling db into client bundle
    const { db } = await import('@/lib/db');
    const { loyaltyTiers } = await import('@/lib/db/schema');
    const { eq, asc } = await import('drizzle-orm');
    const rows = await db.select().from(loyaltyTiers).where(eq(loyaltyTiers.active, true)).orderBy(asc(loyaltyTiers.sortOrder));
    if (rows.length > 0) {
      _cache = rows.map(r => ({
        id: r.id, tag: r.tag, label: r.label,
        monthlyFee: r.monthlyFee ? Number(r.monthlyFee) : null,
        annualFee: r.annualFee ? Number(r.annualFee) : null,
        monthlyCredit: Number(r.monthlyCredit), birthdayCredit: Number(r.birthdayCredit ?? 20),
        tradeInRate: Number(r.tradeInRate), lensRefresh: r.lensRefresh ?? false,
        frameRotation: r.frameRotation,
        shippingTier: r.shippingTier ?? null,
        earlyAccessHours: r.earlyAccessHours ?? 0,
        namedOptician: r.namedOptician ?? false,
        freeRepairs: r.freeRepairs ?? null,
        styleConsultation: r.styleConsultation ?? null,
        eventsPerYear: r.eventsPerYear ?? 0,
        annualGift: r.annualGift ?? false,
        archiveVote: r.archiveVote ?? false,
        privateWhatsapp: r.privateWhatsapp ?? false,
        referralRewardCredit: r.referralRewardCredit ? Number(r.referralRewardCredit) : null,
        referralExtensionMonths: r.referralExtensionMonths ?? 0,
        referredDiscount: r.referredDiscount ? Number(r.referredDiscount) : null,
        referredTrialTier: r.referredTrialTier ?? null,
      }));
    } else {
      _cache = Object.entries(TIERS).map(([id, t]) => ({ id, ...t } as TierConfig));
    }
  } catch {
    _cache = Object.entries(TIERS).map(([id, t]) => ({ id, ...t } as TierConfig));
  }
  _cacheTime = Date.now();
  return _cache!;
}

export function invalidateTierCache() { _cache = null; }
