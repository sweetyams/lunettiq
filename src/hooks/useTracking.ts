'use client';

/**
 * useTracking — hook for firing tracking events from components.
 * Wraps the unified track() dispatcher.
 * 
 * Usage:
 *   const { trackViewItem, trackAddToCart, trackSearch } = useTracking();
 */

import { useCallback } from 'react';
import { track } from '@/lib/tracking';

export function useTracking() {
  const trackPageView = useCallback((path: string, title: string) => {
    track({ event: 'page_view', data: { path, title } });
  }, []);

  const trackViewItem = useCallback((item: { id: string; name: string; price: number; currency?: string; category?: string }) => {
    track({ event: 'view_item', data: { ...item, currency: item.currency ?? 'CAD' } });
  }, []);

  const trackAddToCart = useCallback((item: { id: string; name: string; price: number; quantity: number; currency?: string }) => {
    track({ event: 'add_to_cart', data: { ...item, currency: item.currency ?? 'CAD' } });
  }, []);

  const trackBeginCheckout = useCallback((value: number, items: Array<{ id: string; name: string; price: number; quantity: number }>) => {
    track({ event: 'begin_checkout', data: { value, currency: 'CAD', items } });
  }, []);

  const trackSearch = useCallback((query: string, resultCount: number) => {
    track({ event: 'search', data: { query, resultCount } });
  }, []);

  const trackSignUp = useCallback((method?: string) => {
    track({ event: 'sign_up', data: { method } });
  }, []);

  const trackAddToWishlist = useCallback((item: { id: string; name: string; price: number }) => {
    track({ event: 'add_to_wishlist', data: item });
  }, []);

  return { trackPageView, trackViewItem, trackAddToCart, trackBeginCheckout, trackSearch, trackSignUp, trackAddToWishlist };
}
