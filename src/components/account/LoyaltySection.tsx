import type { LoyaltyData } from '@/types/customer';
import Link from 'next/link';

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
        <div className="border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-lg mb-1">◆</p>
          <p className="text-sm font-medium mb-1">Join Lunettiq Membership</p>
          <p className="text-sm text-gray-500 mb-4">Monthly credits, exclusive access, and a named optician who knows your style.</p>
          <Link href="/pages/membership" className="inline-block px-6 py-2.5 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors">
            View Plans
          </Link>
        </div>
      </div>
    );
  }

  const tierInfo = TIER_CONFIG[loyalty.tier] ?? TIER_CONFIG.essential;

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
          {loyalty.points > 0 && <span className="text-sm text-gray-500">{loyalty.points} points</span>}
        </div>

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

        {/* Upgrade CTA */}
        {loyalty.tier !== 'vault' && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <Link href="/pages/membership" className="text-xs text-gray-500 hover:text-black underline">
              Upgrade your plan →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
