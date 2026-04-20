'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/tracking';

/**
 * Tracks page views on route changes.
 * Also fires account_login when user lands on /account from auth callback.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    track({ event: 'page_view', data: { path: pathname, title: document.title } });

    // Detect login: user arrived at /account (callback redirects here)
    if (pathname === '/account' && document.referrer.includes('/api/auth/callback')) {
      track({ event: 'account_login', data: {} });
    }
  }, [pathname]);

  return null;
}
