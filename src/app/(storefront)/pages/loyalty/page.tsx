import { TIERS, TierKey } from '@/lib/crm/loyalty-config';
import Link from 'next/link';

const BENEFITS: Record<TierKey, { features: string[]; highlight: string }> = {
  essential: {
    highlight: 'The perfect start',
    features: ['$15/month store credit', '$20 birthday credit', '20% trade-in on old frames', 'Free standard shipping', 'Early access to new releases', 'Member-only pricing events'],
  },
  cult: {
    highlight: 'Most popular',
    features: ['$30/month store credit', '$20 birthday credit', '30% trade-in on old frames', 'Free express shipping', 'Annual lens refresh (free replacement)', '25% off frame rotation', 'Priority customer support', 'Exclusive CULT events'],
  },
  vault: {
    highlight: 'The ultimate',
    features: ['$60/month store credit', '$20 birthday credit', '37.5% trade-in on old frames', 'Free express shipping', 'Annual lens refresh (free replacement)', 'Free frame swap once per year', 'VIP 1-on-1 styling sessions', 'Vault-only exclusive releases', 'Complimentary adjustments & repairs', 'Early access to collaborations'],
  },
};

const FAQ = [
  { q: 'How do store credits work?', a: 'Credits are added to your account on the 1st of each month. Use them toward any purchase — frames, lenses, or accessories. Credits don\'t expire as long as your membership is active.' },
  { q: 'What is the trade-in program?', a: 'Bring in any old eyewear (any brand) and receive credit toward new Lunettiq frames. Your trade-in value depends on your tier.' },
  { q: 'What is a lens refresh?', a: 'CULT and VAULT members get one free lens replacement per year. Perfect for updating your prescription without buying new frames.' },
  { q: 'What is frame rotation?', a: 'CULT members get 25% off swapping their frames for a different style. VAULT members get one free frame swap per year.' },
  { q: 'Can I change tiers?', a: 'Yes — upgrade anytime and your new benefits start immediately. Downgrade takes effect at your next renewal date.' },
  { q: 'What happens if I cancel?', a: 'You keep your benefits for 60 days after cancellation. Any remaining credits can be used during this grace period.' },
];

export default function LoyaltyLandingPage() {
  return (
    <div className="site-container py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-medium tracking-tight mb-4">Lunettiq Loyalty</h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto">Monthly credits, exclusive perks, and a smarter way to build your eyewear collection.</p>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
        {(Object.entries(TIERS) as [string, (typeof TIERS)[keyof typeof TIERS]][]).map(([key, tier]) => {
          const info = BENEFITS[key];
          const isVault = key === 'vault';
          const isCult = key === 'cult';
          return (
            <div key={key} className={`border rounded-2xl p-8 flex flex-col ${isVault ? 'border-black bg-black text-white' : isCult ? 'border-black' : 'border-gray-200'}`}>
              {isCult && <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">{info.highlight}</div>}
              {isVault && <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{info.highlight}</div>}
              {!isCult && !isVault && <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{info.highlight}</div>}
              <h2 className="text-2xl font-semibold mb-1">{tier.label}</h2>
              <div className="text-3xl font-semibold mb-6">
                ${tier.monthlyCredit}<span className={`text-sm font-normal ${isVault ? 'text-gray-400' : 'text-gray-500'}`}>/month</span>
              </div>
              <ul className="space-y-3 flex-1">
                {info.features.map(f => (
                  <li key={f} className={`text-sm flex items-start gap-2 ${isVault ? 'text-gray-300' : 'text-gray-600'}`}>
                    <span className={`mt-0.5 ${isVault ? 'text-white' : 'text-black'}`}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/account/loyalty" className={`mt-8 block text-center py-3 rounded-lg text-sm font-medium transition-colors ${isVault ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-gray-800'}`}>
                Join {tier.label}
              </Link>
            </div>
          );
        })}
      </div>

      {/* How it works */}
      <div className="mb-20">
        <h2 className="text-2xl font-medium text-center mb-10">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: '01', title: 'Choose your tier', desc: 'Pick the membership level that fits your eyewear habits.' },
            { step: '02', title: 'Earn monthly credits', desc: 'Credits land in your account on the 1st of every month.' },
            { step: '03', title: 'Shop & save', desc: 'Apply credits to any purchase — frames, lenses, accessories.' },
            { step: '04', title: 'Enjoy perks', desc: 'Trade-ins, lens refreshes, frame rotations, and more.' },
          ].map(s => (
            <div key={s.step} className="text-center">
              <div className="text-3xl font-light text-gray-300 mb-3">{s.step}</div>
              <h3 className="text-sm font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trade-in comparison */}
      <div className="mb-20 border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-8 text-center border-b border-gray-200">
          <h2 className="text-xl font-medium">Second Sight Trade-In</h2>
          <p className="text-sm text-gray-500 mt-1">Bring in any old eyewear and get credit toward new frames</p>
        </div>
        <div className="grid grid-cols-3">
          {(Object.entries(TIERS) as [string, (typeof TIERS)[keyof typeof TIERS]][]).map(([key, tier], i) => (
            <div key={key} className={`p-6 text-center ${i < 2 ? 'border-r border-gray-200' : ''}`}>
              <div className="text-sm font-semibold mb-2">{tier.label}</div>
              <div className="text-3xl font-semibold">{tier.tradeInRate * 100}%</div>
              <div className="text-xs text-gray-500 mt-1">of assessed value</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-medium text-center mb-8">Questions</h2>
        <div className="space-y-4">
          {FAQ.map(f => (
            <details key={f.q} className="border border-gray-200 rounded-lg">
              <summary className="p-4 text-sm font-medium cursor-pointer">{f.q}</summary>
              <p className="px-4 pb-4 text-sm text-gray-500">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Points */}
      <div className="mb-20 border border-gray-200 rounded-2xl overflow-hidden">
        <div className="p-8 text-center border-b border-gray-200">
          <h2 className="text-xl font-medium">Lunettiq Points</h2>
          <p className="text-sm text-gray-500 mt-1">Free to join. Earn on every purchase. Redeem or convert to membership.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          {[
            { action: 'Every $1 spent', pts: '1 pt' },
            { action: 'First purchase', pts: '500 pts' },
            { action: 'Refer a friend', pts: '2,500 pts' },
            { action: 'Birthday', pts: '200 pts' },
          ].map((r, i) => (
            <div key={r.action} className={`p-5 text-center ${i < 3 ? 'border-r border-gray-200' : ''}`}>
              <div className="text-lg font-semibold">{r.pts}</div>
              <div className="text-xs text-gray-500 mt-1">{r.action}</div>
            </div>
          ))}
        </div>
        <div className="p-6 text-center text-sm text-gray-500 border-t border-gray-200">
          100 points = $5 · Redeem at checkout or convert to membership time
        </div>
      </div>

      {/* Referral */}
      <div className="mb-20 text-center">
        <h2 className="text-2xl font-medium mb-3">Share the vision</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">Share Lunettiq with someone whose taste you respect. They get $25 off, you earn 2,500 points ($125).</p>
        <div className="inline-grid grid-cols-3 gap-6 text-center">
          <div><div className="text-2xl font-semibold">$25</div><div className="text-xs text-gray-500">They save</div></div>
          <div><div className="text-2xl font-semibold">2,500</div><div className="text-xs text-gray-500">Points you earn</div></div>
          <div><div className="text-2xl font-semibold">∞</div><div className="text-xs text-gray-500">No cap</div></div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-16 py-12 border-t border-gray-100">
        <h2 className="text-xl font-medium mb-2">Ready to join?</h2>
        <p className="text-sm text-gray-500 mb-6">Visit any Lunettiq location to enroll, or contact us to get started.</p>
        <div className="flex gap-4 justify-center">
          <Link href="/pages/stores" className="px-6 py-3 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors">Find a Store</Link>
          <Link href="/account/loyalty" className="px-6 py-3 border border-black text-sm rounded-lg hover:bg-gray-50 transition-colors">Check My Status</Link>
        </div>
      </div>
    </div>
  );
}
