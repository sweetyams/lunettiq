'use client';

import { useEffect, useState } from 'react';
import type { MemberContext } from '@/app/api/account/personalization/route';

interface Props {
  productId: string;
  frameWidthMm?: number | null;
}

export default function PDPPersonalization({ productId, frameWidthMm }: Props) {
  const [ctx, setCtx] = useState<MemberContext | null>(null);

  useEffect(() => {
    fetch('/api/account/personalization')
      .then(r => r.json())
      .then(d => { if (d.data) setCtx(d.data); })
      .catch(() => {});
  }, []);

  if (!ctx) return null;

  const isCultPlus = ctx.tier === 'cult' || ctx.tier === 'vault';
  const rec = ctx.recommendations.find(r => r.productId === productId);

  // Fit confidence
  let fitLine: { text: string; tone: 'good' | 'wider' | 'narrower' } | null = null;
  if (ctx.fit?.frameWidthMm && frameWidthMm) {
    const diff = frameWidthMm - ctx.fit.frameWidthMm;
    if (Math.abs(diff) <= 2) fitLine = { text: 'Good fit for your measurements', tone: 'good' };
    else if (diff > 3) fitLine = { text: 'Runs wider than your usual', tone: 'wider' };
    else if (diff < -3) fitLine = { text: 'Runs narrower than your usual', tone: 'narrower' };
  }

  const hasSignals = ctx.creditBalance > 0 || ctx.rx || fitLine || (isCultPlus && rec);
  if (!hasSignals) return null;

  return (
    <div className="space-y-2 text-sm">
      {/* Credits preview */}
      {ctx.creditBalance > 0 && (
        <p className="text-gray-500">
          Apply ${ctx.creditBalance.toFixed(0)} credit at checkout
        </p>
      )}

      {/* Rx readiness */}
      {ctx.rx && ctx.rx.daysUntilExpiry != null && ctx.rx.daysUntilExpiry <= 90 && ctx.rx.daysUntilExpiry > 0 && (
        <p className="text-amber-600 text-xs">
          Rx on file expires {ctx.rx.expiresApprox}
        </p>
      )}

      {/* Fit confidence */}
      {fitLine && (
        <p className={`text-xs ${
          fitLine.tone === 'good' ? 'text-green-600' :
          fitLine.tone === 'wider' ? 'text-amber-600' : 'text-amber-600'
        }`}>
          {fitLine.text}
        </p>
      )}

      {/* Optician recommendation */}
      {isCultPlus && rec && (
        <p className="text-xs text-gray-500">
          Recommended for you by {rec.staffName ?? 'your optician'} on{' '}
          {new Date(rec.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
        </p>
      )}
    </div>
  );
}
