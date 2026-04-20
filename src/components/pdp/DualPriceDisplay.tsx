'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Props {
  price: number;
  currencyCode?: string;
}

export default function DualPriceDisplay({ price, currencyCode = 'CAD' }: Props) {
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/account/points', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setPoints(d.data.balance); })
      .catch(() => {});
    // Check tier from cookie/session — simplified: check loyalty page
    fetch('/api/account/loyalty-status', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data?.tier) setTier(d.data.tier); })
      .catch(() => {});
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: currencyCode }).format(n);

  // Points discount: max 25% of price
  const maxPointsDiscount = price * 0.25;
  const pointsDollars = points ? Math.min(Math.floor(points / 100) * 5, maxPointsDiscount) : 0;
  const pointsPrice = price - pointsDollars;

  // Member price: monthly credit applied (simplified — show CULT savings)
  const cultMonthlyCredit = 25;
  const memberPrice = price - cultMonthlyCredit;

  return (
    <div className="mt-2">
      <p className="text-lg text-gray-700">{fmt(price)}</p>

      {points !== null && points >= 200 && (
        <p className="text-sm text-gray-500 mt-1">
          With your {points.toLocaleString()} pts: <span className="font-medium text-black">{fmt(pointsPrice)}</span>
          <span className="text-xs text-gray-400 ml-1">(–{fmt(pointsDollars)})</span>
        </p>
      )}

      {!tier && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <p className="text-sm">
            With CULT: <span className="font-medium text-black">{fmt(memberPrice)}</span>
            <span className="text-xs text-gray-400 ml-1">(–{fmt(cultMonthlyCredit)})</span>
          </p>
          <Link href="/pages/loyalty" className="text-xs text-gray-500 underline">
            Try CULT free for 30 days →
          </Link>
        </div>
      )}

      {tier && (
        <p className="text-xs text-green-600 mt-1">◆ {tier.toUpperCase()} member pricing applied at checkout</p>
      )}
    </div>
  );
}
