'use client';

import Link from 'next/link';

interface Props {
  lastOrderDate: string;
  tradeInRate: number;
  tier: string | null;
}

export default function TradeInRadar({ lastOrderDate, tradeInRate, tier }: Props) {
  const monthsAgo = Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (monthsAgo < 12) return null;

  const pct = Math.round(tradeInRate * 100);

  return (
    <div className="border border-gray-200 rounded-lg p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Ready for Second Sight?</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Your frames are {monthsAgo} months old. Trade in for up to {pct}% credit
          {tier && <> as a {tier.toUpperCase()} member</>}.
        </p>
      </div>
      <Link
        href="/pages/stores"
        className="shrink-0 px-4 py-2 text-xs border border-black rounded-full hover:bg-black hover:text-white transition-colors"
      >
        Find a store
      </Link>
    </div>
  );
}
