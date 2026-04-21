'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/tracking';

/**
 * Tracks page views on route changes.
 * Identifies user with PostHog when logged in.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const identified = useRef(false);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    track({ event: 'page_view', data: { path: pathname, title: document.title } });

    // Detect login: user arrived at /account (callback redirects here)
    if (pathname === '/account' && document.referrer.includes('/api/auth/callback')) {
      track({ event: 'account_login', data: {} });
    }
  }, [pathname]);

  // Identify user once per session
  useEffect(() => {
    if (identified.current) return;
    identified.current = true;

    fetch('/api/account/me')
      .then(r => r.json())
      .then(d => {
        if (!d.data) return;
        const w = window as any;
        if (w.posthog) {
          w.posthog.identify(d.data.id, {
            email: d.data.email,
            first_name: d.data.firstName,
            last_name: d.data.lastName,
          });
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
