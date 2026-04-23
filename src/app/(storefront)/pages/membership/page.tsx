import { loadTiers, type TierConfig } from '@/lib/crm/loyalty-config';
import { MEMBERSHIP_VARIANTS } from '@/lib/crm/membership-config';
import { MembershipActions } from './MembershipActions';
import Link from 'next/link';

export const revalidate = 60;

function getVariantGid(tier: string, period: 'monthly' | 'annual') {
  const sku = `MEMBERSHIP-${tier.toUpperCase()}-${period.toUpperCase()}`;
  return MEMBERSHIP_VARIANTS[sku]?.variantGid ?? null;
}

function buildBenefits(tier: TierConfig, prev: TierConfig | null): string[] {
  const b: string[] = [];
  if (prev) b.push(`Everything in ${prev.label}, plus:`);
  if (tier.shippingTier) b.push(`Free ${tier.shippingTier} shipping on all orders`);
  b.push(`$${tier.monthlyCredit}/month in store credit ($${tier.monthlyCredit * 12}/year)`);
  if (tier.namedOptician) b.push('Named optician — your personal stylist');
  if (tier.lensRefresh) b.push('Lens refresh');
  if (tier.frameRotation) b.push(`Frame rotation: ${tier.frameRotation}`);
  b.push(`${Math.round(tier.tradeInRate * 100)}% Second Sight trade-in rate`);
  if (tier.earlyAccessHours > 0) b.push(`Early access to new drops (${tier.earlyAccessHours}h)`);
  b.push(`Birthday reward ($${tier.birthdayCredit} credit)`);
  if (tier.freeRepairs) b.push(`Free repairs: ${tier.freeRepairs}`);
  if (tier.styleConsultation) b.push(`Style consultation: ${tier.styleConsultation}`);
  if (tier.eventsPerYear > 0) b.push(`${tier.eventsPerYear} brand event${tier.eventsPerYear > 1 ? 's' : ''}/year`);
  if (tier.annualGift) b.push('Annual gift from the brand');
  if (tier.archiveVote) b.push('Archive vote — choose the next reissue');
  if (tier.privateWhatsapp) b.push('Private WhatsApp line');
  return b;
}

const TIER_STYLES: Record<string, { color: string; popular?: boolean }> = {
  essential: { color: 'bg-gray-100 text-black' },
  cult: { color: 'bg-amber-400 text-black', popular: true },
  vault: { color: 'bg-black text-white' },
};

export default async function MembershipPage() {
  const tiers = await loadTiers();

  const cards = tiers.map((tier, i) => {
    const style = TIER_STYLES[tier.id] ?? { color: 'bg-gray-100 text-black' };
    const prev = i > 0 ? tiers[i - 1] : null;
    const benefits = buildBenefits(tier, prev);
    const monthlyGid = getVariantGid(tier.id, 'monthly');
    const annualGid = getVariantGid(tier.id, 'annual');
    const annualSave = tier.monthlyFee && tier.annualFee ? tier.monthlyFee * 12 - tier.annualFee : null;

    return {
      ...tier, ...style, benefits, monthlyGid, annualGid,
      annualSave: annualSave && annualSave > 0 ? annualSave : null,
    };
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-3xl md:text-4xl font-light tracking-wide mb-4">Membership</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Join the inner circle. Monthly credits, exclusive access, and a named optician who knows your style.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {cards.map(card => (
          <div key={card.id} className={`border rounded-2xl overflow-hidden ${card.popular ? 'border-black ring-1 ring-black' : 'border-gray-200'}`}>
            {card.popular && (
              <div className="bg-black text-white text-center text-xs py-1.5 font-medium tracking-wider uppercase">Most Popular</div>
            )}
            <div className={`px-6 py-5 ${card.color}`}>
              <h2 className="text-xl font-medium">{card.label}</h2>
              {card.monthlyFee != null && (
                <div className="mt-2">
                  <span className="text-3xl font-semibold">${card.monthlyFee}</span>
                  <span className="text-sm opacity-75">/mo</span>
                </div>
              )}
            </div>

            <div className="px-6 py-6">
              <ul className="space-y-2.5 mb-6">
                {card.benefits.map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <span className="text-green-600 mt-0.5 shrink-0">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <MembershipActions
                tierLabel={card.label}
                monthlyFee={card.monthlyFee}
                annualFee={card.annualFee}
                annualSave={card.annualSave}
                monthlyGid={card.monthlyGid}
                annualGid={card.annualGid}
                monthlyCredit={card.monthlyCredit}
                tradeInRate={card.tradeInRate}
                shippingTier={card.shippingTier}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-400 space-y-2">
        <p>Cancel anytime. Credits don&apos;t expire while your membership is active.</p>
        <p>
          <Link href="/pages/loyalty" className="underline hover:text-black">Compare all tier benefits</Link>
          {' · '}
          <Link href="/account/loyalty" className="underline hover:text-black">Manage your membership</Link>
        </p>
      </div>
    </div>
  );
}
