/**
 * Unified Pixel & Tracking Registry
 * 
 * All tracking pixels are managed here. Each can be toggled on/off
 * via the integrations settings. Consent-gated where required (Law 25).
 */

export interface PixelConfig {
  id: string;
  name: string;
  requiresConsent: boolean; // Law 25: needs cookie consent before firing
  scriptType: 'inline' | 'external';
}

export const PIXELS: PixelConfig[] = [
  { id: 'polar', name: 'Polar Analytics', requiresConsent: false, scriptType: 'external' },
  { id: 'meta', name: 'Meta Pixel (Facebook/Instagram)', requiresConsent: true, scriptType: 'inline' },
  { id: 'tiktok', name: 'TikTok Pixel', requiresConsent: true, scriptType: 'inline' },
  { id: 'google_analytics', name: 'Google Analytics 4', requiresConsent: true, scriptType: 'external' },
  { id: 'google_ads', name: 'Google Ads', requiresConsent: true, scriptType: 'inline' },
  { id: 'pinterest', name: 'Pinterest Tag', requiresConsent: true, scriptType: 'inline' },
  { id: 'snapchat', name: 'Snapchat Pixel', requiresConsent: true, scriptType: 'inline' },
  { id: 'posthog', name: 'PostHog', requiresConsent: false, scriptType: 'external' },
];

/**
 * Standard e-commerce events all pixels should receive.
 */
export type TrackingEvent =
  | { event: 'page_view'; data: { path: string; title: string } }
  | { event: 'view_item'; data: { id: string; name: string; price: number; currency: string; category?: string } }
  | { event: 'add_to_cart'; data: { id: string; name: string; price: number; quantity: number; currency: string } }
  | { event: 'begin_checkout'; data: { value: number; currency: string; items: Array<{ id: string; name: string; price: number; quantity: number }> } }
  | { event: 'purchase'; data: { orderId: string; value: number; currency: string; items: Array<{ id: string; name: string; price: number; quantity: number }> } }
  | { event: 'search'; data: { query: string; resultCount: number } }
  | { event: 'sign_up'; data: { method?: string } }
  | { event: 'add_to_wishlist'; data: { id: string; name: string; price: number } }
  // Lunettiq-specific
  | { event: 'lens_config_start'; data: { productId: string; productName: string } }
  | { event: 'lens_config_step'; data: { productId: string; step: string; selection?: string } }
  | { event: 'lens_config_complete'; data: { productId: string; lensType: string; totalPrice: number } }
  | { event: 'consent_granted'; data: Record<string, never> }
  | { event: 'consent_denied'; data: Record<string, never> }
  | { event: 'account_login'; data: Record<string, never> }
  | { event: 'virtual_tryon_start'; data: { productId: string } }
  | { event: 'newsletter_signup'; data: { source: string } }
  | { event: 'membership_view'; data: { tier?: string } };
