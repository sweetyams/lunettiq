'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useCartDrawer } from '@/context/CartDrawerContext';

export function MembershipActions({
  tierLabel, monthlyFee, annualFee, annualSave,
  monthlyGid, annualGid, monthlyCredit, tradeInRate, shippingTier,
}: {
  tierLabel: string;
  monthlyFee: number | null;
  annualFee: number | null;
  annualSave: number | null;
  monthlyGid: string | null;
  annualGid: string | null;
  monthlyCredit: number;
  tradeInRate: number;
  shippingTier: string | null;
}) {
  const { addToCart } = useCart();
  const { openCart } = useCartDrawer();
  const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null);

  const cartNote = `$${monthlyCredit}/mo credit · ${Math.round(tradeInRate * 100)}% trade-in${shippingTier ? ` · ${shippingTier.charAt(0).toUpperCase() + shippingTier.slice(1)} shipping` : ''}`;

  async function handleAdd(gid: string, which: 'monthly' | 'annual') {
    setLoading(which);
    await addToCart(gid, 1, [{ key: 'Includes', value: cartNote }]);
    openCart();
    setLoading(null);
  }

  return (
    <div className="space-y-2.5">
      {monthlyGid && monthlyFee != null && (
        <button
          onClick={() => handleAdd(monthlyGid, 'monthly')}
          disabled={!!loading}
          className="block w-full text-center py-3 rounded-full text-sm font-medium transition-colors disabled:opacity-50 bg-black text-white hover:bg-gray-800"
        >
          {loading === 'monthly' ? 'Adding...' : `Join ${tierLabel} — $${monthlyFee}/mo`}
        </button>
      )}
      {annualGid && annualFee != null && (
        <button
          onClick={() => handleAdd(annualGid, 'annual')}
          disabled={!!loading}
          className="block w-full text-center py-3 rounded-full text-sm font-medium transition-colors disabled:opacity-50 border border-gray-300 text-gray-700 hover:border-black hover:text-black"
        >
          {loading === 'annual' ? 'Adding...' : `Annual — $${annualFee}/yr${annualSave ? ` (save $${annualSave})` : ''}`}
        </button>
      )}
    </div>
  );
}
