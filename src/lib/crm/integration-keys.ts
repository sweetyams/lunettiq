/**
 * Server-side integration key resolver.
 * 
 * Provides async getters for all integration keys.
 * Reads from DB first (staff-configured), falls back to env vars.
 * 
 * Usage:
 *   import { getKey } from '@/lib/crm/integration-keys';
 *   const token = await getKey('SHOPIFY_ADMIN_API_ACCESS_TOKEN');
 */

import { getIntegrationKey, isIntegrationEnabled } from './integrations';

// Map key names → integration IDs for lookup
const KEY_TO_INTEGRATION: Record<string, string> = {
  // Shopify
  NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN: 'shopify',
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'shopify',
  SHOPIFY_ADMIN_API_ACCESS_TOKEN: 'shopify',
  SHOPIFY_WEBHOOK_SECRET: 'shopify',
  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'clerk',
  CLERK_SECRET_KEY: 'clerk',
  // Neon
  DATABASE_URL: 'neon',
  // Inngest
  INNGEST_EVENT_KEY: 'inngest',
  INNGEST_SIGNING_KEY: 'inngest',
  // Upstash
  UPSTASH_REDIS_REST_URL: 'upstash',
  UPSTASH_REDIS_REST_TOKEN: 'upstash',
  // Square
  SQUARE_APPLICATION_ID: 'square',
  SQUARE_ACCESS_TOKEN: 'square',
  SQUARE_WEBHOOK_SIGNATURE_KEY: 'square',
  // Anthropic
  ANTHROPIC_API_KEY: 'anthropic',
  // Klaviyo
  KLAVIYO_API_KEY: 'klaviyo',
  KLAVIYO_PRIVATE_KEY: 'klaviyo',
  // PostHog
  NEXT_PUBLIC_POSTHOG_KEY: 'posthog',
  NEXT_PUBLIC_POSTHOG_HOST: 'posthog',
  // Polar
  NEXT_PUBLIC_POLAR_SITE_ID: 'polar',
  // Pixels
  NEXT_PUBLIC_META_PIXEL_ID: 'meta_pixel',
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: 'tiktok_pixel',
  NEXT_PUBLIC_GA4_ID: 'google_analytics',
  NEXT_PUBLIC_PINTEREST_TAG_ID: 'pinterest_tag',
  NEXT_PUBLIC_SNAPCHAT_PIXEL_ID: 'snapchat_pixel',
  // Yotpo
  YOTPO_APP_KEY: 'yotpo',
  YOTPO_SECRET_KEY: 'yotpo',
};

/**
 * Get a key value. Checks DB (staff-configured) first, falls back to env var.
 */
export async function getKey(keyName: string): Promise<string | null> {
  const integrationId = KEY_TO_INTEGRATION[keyName];
  if (!integrationId) return process.env[keyName] ?? null;
  return getIntegrationKey(integrationId, keyName);
}

/**
 * Get a key value, throw if missing. For required keys.
 */
export async function requireKey(keyName: string): Promise<string> {
  const value = await getKey(keyName);
  if (!value) throw new Error(`Integration key ${keyName} not configured`);
  return value;
}

/**
 * Check if an integration is available (enabled + has required key).
 */
export { isIntegrationEnabled } from './integrations';
