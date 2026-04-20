'use client';

import { useEffect, useState } from 'react';
import type { MemberContext } from '@/app/api/account/personalization/route';
import KnownAboutYou from './KnownAboutYou';
import OpticianShelf from './OpticianShelf';
import LensRefreshCard from './LensRefreshCard';
import TradeInRadar from './TradeInRadar';

export default function AccountPersonalization() {
  const [ctx, setCtx] = useState<MemberContext | null>(null);

  useEffect(() => {
    fetch('/api/account/personalization')
      .then(r => r.json())
      .then(d => setCtx(d.data))
      .catch(() => {});
  }, []);

  if (!ctx) return null;

  const isCultPlus = ctx.tier === 'cult' || ctx.tier === 'vault';

  return (
    <div className="mb-10 space-y-4">
      <KnownAboutYou ctx={ctx} />
      {isCultPlus && ctx.recommendations.length > 0 && (
        <OpticianShelf recommendations={ctx.recommendations} opticianName={ctx.namedOptician} />
      )}
      {ctx.lensRefresh && <LensRefreshCard lastOrderDate={ctx.lastOrderDate} />}
      {ctx.tradeInRate > 0 && ctx.lastOrderDate && (
        <TradeInRadar lastOrderDate={ctx.lastOrderDate} tradeInRate={ctx.tradeInRate} tier={ctx.tier} />
      )}
    </div>
  );
}
