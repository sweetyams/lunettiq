'use client';

/**
 * Unified tracking dispatcher.
 * Fires events to all enabled pixels that have consent.
 * 
 * Usage:
 *   import { track } from '@/lib/tracking';
 *   track({ event: 'view_item', data: { id, name, price, currency: 'CAD' } });
 */

import type { TrackingEvent } from './registry';

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('lunettiq_tracking_consent') === 'granted';
}

function isEnabled(pixelId: string): boolean {
  if (typeof window === 'undefined') return false;
  const config = localStorage.getItem('lunettiq_pixels_enabled');
  if (!config) return true; // default: all enabled
  try { return JSON.parse(config)[pixelId] !== false; } catch { return true; }
}

// ─── Pixel dispatchers ───────────────────────────────────

function firePolar(e: TrackingEvent) {
  const w = window as any;
  if (!w.polar) return;
  if (e.event === 'page_view') return; // Polar auto-tracks pageviews
  if (e.event === 'add_to_cart') w.polar('track', 'AddToCart', e.data);
  if (e.event === 'begin_checkout') w.polar('track', 'InitiateCheckout', e.data);
  if (e.event === 'purchase') w.polar('track', 'Purchase', e.data);
}

function fireMeta(e: TrackingEvent) {
  const w = window as any;
  if (!w.fbq) return;
  if (e.event === 'page_view') w.fbq('track', 'PageView');
  if (e.event === 'view_item') w.fbq('track', 'ViewContent', { content_ids: [e.data.id], content_type: 'product', value: e.data.price, currency: e.data.currency });
  if (e.event === 'add_to_cart') w.fbq('track', 'AddToCart', { content_ids: [e.data.id], content_type: 'product', value: e.data.price, currency: e.data.currency });
  if (e.event === 'begin_checkout') w.fbq('track', 'InitiateCheckout', { value: e.data.value, currency: e.data.currency });
  if (e.event === 'purchase') w.fbq('track', 'Purchase', { value: e.data.value, currency: e.data.currency, content_ids: e.data.items.map(i => i.id) });
  if (e.event === 'search') w.fbq('track', 'Search', { search_string: e.data.query });
  if (e.event === 'add_to_wishlist') w.fbq('track', 'AddToWishlist', { content_ids: [e.data.id], value: e.data.price, currency: 'CAD' });
}

function fireTikTok(e: TrackingEvent) {
  const w = window as any;
  if (!w.ttq) return;
  if (e.event === 'page_view') w.ttq.page();
  if (e.event === 'view_item') w.ttq.track('ViewContent', { content_id: e.data.id, content_type: 'product', value: e.data.price, currency: e.data.currency });
  if (e.event === 'add_to_cart') w.ttq.track('AddToCart', { content_id: e.data.id, value: e.data.price, currency: e.data.currency });
  if (e.event === 'begin_checkout') w.ttq.track('InitiateCheckout', { value: e.data.value, currency: e.data.currency });
  if (e.event === 'purchase') w.ttq.track('CompletePayment', { value: e.data.value, currency: e.data.currency });
}

function fireGA4(e: TrackingEvent) {
  const w = window as any;
  if (!w.gtag) return;
  if (e.event === 'page_view') w.gtag('event', 'page_view', { page_path: e.data.path });
  if (e.event === 'view_item') w.gtag('event', 'view_item', { items: [{ item_id: e.data.id, item_name: e.data.name, price: e.data.price }], currency: e.data.currency });
  if (e.event === 'add_to_cart') w.gtag('event', 'add_to_cart', { items: [{ item_id: e.data.id, item_name: e.data.name, price: e.data.price, quantity: e.data.quantity }], currency: e.data.currency });
  if (e.event === 'begin_checkout') w.gtag('event', 'begin_checkout', { value: e.data.value, currency: e.data.currency });
  if (e.event === 'purchase') w.gtag('event', 'purchase', { transaction_id: e.data.orderId, value: e.data.value, currency: e.data.currency, items: e.data.items.map(i => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })) });
  if (e.event === 'search') w.gtag('event', 'search', { search_term: e.data.query });
}

function firePinterest(e: TrackingEvent) {
  const w = window as any;
  if (!w.pintrk) return;
  if (e.event === 'page_view') w.pintrk('page');
  if (e.event === 'view_item') w.pintrk('track', 'pagevisit', { product_id: e.data.id });
  if (e.event === 'add_to_cart') w.pintrk('track', 'addtocart', { product_id: e.data.id, value: e.data.price, currency: e.data.currency });
  if (e.event === 'purchase') w.pintrk('track', 'checkout', { value: e.data.value, currency: e.data.currency, order_id: e.data.orderId });
}

function firePostHog(e: TrackingEvent) {
  const w = window as any;
  if (!w.posthog) return;
  w.posthog.capture(e.event, 'data' in e ? e.data : {});
}

// ─── Main dispatcher ─────────────────────────────────────

const CONSENT_REQUIRED = new Set(['meta', 'tiktok', 'google_analytics', 'google_ads', 'pinterest', 'snapchat']);

const DISPATCHERS: Record<string, (e: TrackingEvent) => void> = {
  polar: firePolar,
  meta: fireMeta,
  tiktok: fireTikTok,
  google_analytics: fireGA4,
  google_ads: fireGA4, // same gtag
  pinterest: firePinterest,
  posthog: firePostHog,
};

export function track(event: TrackingEvent) {
  if (typeof window === 'undefined') return;

  const consent = hasConsent();

  for (const [pixelId, dispatch] of Object.entries(DISPATCHERS)) {
    if (!isEnabled(pixelId)) continue;
    if (CONSENT_REQUIRED.has(pixelId) && !consent) continue;
    try { dispatch(event); } catch {}
  }
}
