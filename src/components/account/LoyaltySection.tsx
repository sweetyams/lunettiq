import type { LoyaltyData } from '@/types/customer';

const TIER_CONFIG: Record<string, { label: string; color: string; benefits: string[] }> = {
  essential: {
    label: 'Essential',
    color: 'bg-gray-200',
    benefits: ['Free standard shipping', 'Birthday reward', 'Early access to sales'],
  },
  cult: {
    label: 'CULT',
    color: 'bg-amber-400',
    benefits: [
      'Free express shipping',
      'Birthday reward',
      'Early access to sales',
      'Exclusive member pricing',
      'Priority customer support',
    ],
  },
  vault: {
    label: 'VAULT',
    color: 'bg-black',
    benefits: [
      'Free express shipping',
      'Birthday reward',
      'Early access to sales',
      'Exclusive member pricing',
      'Priority customer support',
      'Complimentary lens upgrades',
      'VIP styling sessions',
    ],
  },
};

interface LoyaltySectionProps {
  loyalty: LoyaltyData | null;
}

export default function LoyaltySection({ loyalty }: LoyaltySectionProps) {
  if (!loyalty) {
    return (
      <div>
        <h2 className="text-lg font-medium mb-4">Loyalty</h2>
        <div className="border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-500">Loyalty information unavailable.</p>
        </div>
      </div>
    );
  }

  const tierInfo = TIER_CONFIG[loyalty.tier] ?? TIER_CONFIG.essential;
  const progress =
    loyalty.nextTierThreshold > 0
      ? Math.min((loyalty.points / loyalty.nextTierThreshold) * 100, 100)
      : 100;
  const isMaxTier = loyalty.tier === 'vault';

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">Loyalty</h2>
      <div className="border border-gray-200 rounded-lg p-6">
        {/* Tier badge */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
              loyalty.tier === 'vault' ? 'text-white' : 'text-black'
            } ${tierInfo.color}`}
          >
            {tierInfo.label}
          </span>
          <span className="text-sm text-gray-500">{loyalty.points} points</span>
        </div>

        {/* Progress bar */}
        {!isMaxTier && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{loyalty.points} pts</span>
              <span>{loyalty.nextTierThreshold} pts</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {loyalty.nextTierThreshold - loyalty.points} points to next tier
            </p>
          </div>
        )}

        {isMaxTier && (
          <p className="text-xs text-gray-500 mb-4">You&apos;ve reached the highest tier!</p>
        )}

        {/* Benefits */}
        <div>
          <h3 className="text-xs font-medium text-gray-500 mb-2">Your Benefits</h3>
          <ul className="space-y-1">
            {tierInfo.benefits.map((benefit) => (
              <li key={benefit} className="text-sm flex items-center gap-2">
                <span className="text-green-600">✓</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
