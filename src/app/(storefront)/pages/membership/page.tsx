'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useCartDrawer } from '@/context/CartDrawerContext';

const TIERS = [
  {
    key: 'essential', name: 'Essential', color: 'bg-gray-100 text-black',
    monthly: { price: 12, variantGid: 'gid://shopify/ProductVariant/48642305917185' },
    annual: { price: 120, variantGid: 'gid://shopify/ProductVariant/48642305949953', save: 24 },
    cartNote: '$12/mo credit · 15% trade-in · Free shipping',
    benefits: [
      'Free standard shipping on all orders',
      '$12/month in store credit ($144/year)',
      '15% Second Sight trade-in rate',
      'Birthday reward ($25 credit)',
      'Member pricing on select frames',
    ],
  },
  {
    key: 'cult', name: 'CULT', color: 'bg-amber-400 text-black', popular: true,
    monthly: { price: 25, variantGid: 'gid://shopify/ProductVariant/48642305982721' },
    annual: { price: 250, variantGid: 'gid://shopify/ProductVariant/48642306015489', save: 50 },
    cartNote: '$25/mo credit · Named optician · 30% trade-in · Early access',
    benefits: [
      'Everything in Essential, plus:',
      'Free express shipping on all orders',
      '$25/month in store credit ($300/year)',
      'Named optician — your personal stylist',
      'Lens refresh every 18 months',
      '30% Second Sight trade-in rate',
      'Early access to new drops (48h)',
      'Priority customer support',
    ],
  },
  {
    key: 'vault', name: 'VAULT', color: 'bg-black text-white',
    monthly: { price: 45, variantGid: 'gid://shopify/ProductVariant/48642306048257' },
    annual: { price: 450, variantGid: 'gid://shopify/ProductVariant/48642306081025', save: 90 },
    cartNote: '$45/mo credit · Annual gift · Archive vote · Free repairs for life',
    benefits: [
      'Everything in CULT, plus:',
      '$45/month in store credit ($540/year)',
      'Free frame rotation swap',
      '35% Second Sight trade-in rate',
      'Annual gift from the brand',
      'Archive vote — choose the next reissue',
      'Private WhatsApp line',
      'Invitations to brand events',
      'Free repairs for life',
      'Birthday reward ($50 credit)',
    ],
  },
];

function JoinButton({ variantGid, label, primary, cartNote }: { variantGid: string; label: string; primary?: boolean; cartNote: string }) {
  const { addToCart } = useCart();
  const { openCart } = useCartDrawer();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await addToCart(variantGid, 1, [
      { key: 'Includes', value: cartNote },
    ]);
    openCart();
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`block w-full text-center py-3 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
        primary
          ? 'bg-black text-white hover:bg-gray-800'
          : 'border border-gray-300 text-gray-700 hover:border-black hover:text-black'
      }`}
    >
      {loading ? 'Adding...' : label}
    </button>
  );
}

export default function MembershipPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-3xl md:text-4xl font-light tracking-wide mb-4">Membership</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Join the inner circle. Monthly credits, exclusive access, and a named optician who knows your style.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {TIERS.map(tier => (
          <div key={tier.key} className={`border rounded-2xl overflow-hidden ${tier.popular ? 'border-black ring-1 ring-black' : 'border-gray-200'}`}>
            {tier.popular && (
              <div className="bg-black text-white text-center text-xs py-1.5 font-medium tracking-wider uppercase">Most Popular</div>
            )}
            <div className={`px-6 py-5 ${tier.color}`}>
              <h2 className="text-xl font-medium">{tier.name}</h2>
              <div className="mt-2">
                <span className="text-3xl font-semibold">${tier.monthly.price}</span>
                <span className="text-sm opacity-75">/mo</span>
              </div>
            </div>

            <div className="px-6 py-6">
              <ul className="space-y-2.5 mb-6">
                {tier.benefits.map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <span className="text-green-600 mt-0.5 shrink-0">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2.5">
                <JoinButton variantGid={tier.monthly.variantGid} label={`Join ${tier.name} — $${tier.monthly.price}/mo`} primary cartNote={tier.cartNote} />
                <JoinButton variantGid={tier.annual.variantGid} label={`Annual — $${tier.annual.price}/yr${tier.annual.save ? ` (save $${tier.annual.save})` : ''}`} cartNote={tier.cartNote} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-400 space-y-2">
        <p>Cancel anytime. Credits don't expire while your membership is active.</p>
        <p>
          <Link href="/pages/loyalty" className="underline hover:text-black">Compare all tier benefits</Link>
          {' · '}
          <Link href="/account/loyalty" className="underline hover:text-black">Manage your membership</Link>
        </p>
      </div>
    </div>
  );
}
