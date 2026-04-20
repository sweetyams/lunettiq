'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MemberContext } from '@/app/api/account/personalization/route';

interface Nudge {
  text: string;
  href: string;
}

function pickNudge(ctx: MemberContext): Nudge | null {
  // Priority 1: VAULT archive vote
  if (ctx.tier === 'vault') {
    // Placeholder — would check for open vote via separate API
  }

  // Priority 2: Rx expiring within 60 days
  if (ctx.rx?.daysUntilExpiry != null && ctx.rx.daysUntilExpiry <= 60 && ctx.rx.daysUntilExpiry > 0) {
    return { text: 'Your prescription is due for an update', href: '/account/prescriptions' };
  }

  // Priority 3: Credits expiring within 30 days
  if (ctx.creditBalance > 0 && ctx.creditExpiry) {
    const daysUntil = Math.ceil((new Date(ctx.creditExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 30 && daysUntil > 0) {
      return { text: `You have $${ctx.creditBalance.toFixed(0)} in credits, use by ${ctx.creditExpiry}`, href: '/collections/optics' };
    }
  }

  // Priority 4: Referral milestone within 1
  const nextMilestone = [3, 5, 10].find(m => m > ctx.referralCount);
  if (nextMilestone && nextMilestone - ctx.referralCount === 1) {
    return { text: 'One more referral for a tier upgrade', href: '/account/referrals' };
  }

  // Priority 5: Credits available (any balance, not just expiring)
  if (ctx.creditBalance > 0) {
    return { text: `You have $${ctx.creditBalance.toFixed(0)} in credits to use`, href: '/collections/optics' };
  }

  return null;
}
export default function ContextualNudgeBand() {
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    fetch('/api/account/personalization')
      .then(r => r.json())
      .then(d => { if (d.data) setNudge(pickNudge(d.data)); })
      .catch(() => {});
  }, []);

  if (!nudge) return null;

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <div className="site-container py-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">{nudge.text}</p>
        <Link href={nudge.href} className="text-xs text-black underline hover:no-underline shrink-0 ml-4">
          View →
        </Link>
      </div>
    </div>
  );
}
