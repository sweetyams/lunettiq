'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/tracking';

/**
 * Tracks page views + identifies user with PostHog (enriched profile).
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const identified = useRef(false);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    track({ event: 'page_view', data: { path: pathname, title: document.title } });

    if (pathname === '/account' && document.referrer.includes('/api/auth/callback')) {
      track({ event: 'account_login', data: {} });
    }
  }, [pathname]);

  // Identify + super properties once per session
  useEffect(() => {
    if (identified.current) return;
    identified.current = true;

    fetch('/api/account/me')
      .then(r => r.json())
      .then(d => {
        if (!d.data) return;
        const w = window as any;
        if (!w.posthog) return;

        // Identify with full profile
        w.posthog.identify(d.data.id, {
          email: d.data.email,
          first_name: d.data.firstName,
          last_name: d.data.lastName,
          tier: d.data.tier,
          has_membership: d.data.hasMembership,
          lifetime_value: d.data.lifetimeValue,
          total_orders: d.data.totalOrders,
          city: d.data.city,
          joined_at: d.data.joinedAt,
        });

        // Super properties — attached to every future event
        w.posthog.register({
          tier: d.data.tier,
          has_membership: d.data.hasMembership,
          locale: navigator.language,
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
