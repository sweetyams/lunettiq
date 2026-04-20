/**
 * Integration helper — check if an integration is enabled before use.
 * 
 * Usage:
 *   if (await isIntegrationEnabled('klaviyo')) { ... }
 *   const key = await getIntegrationKey('klaviyo', 'KLAVIYO_PRIVATE_KEY');
 * 
 * Falls back to env vars for existing integrations (Shopify, Clerk, etc.)
 * so the app works without the DB config for already-wired integrations.
 */

import { db } from '@/lib/db';
import { integrationsConfig } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Cache for 60 seconds to avoid DB hits on every request
let _cache: Map<string, { enabled: boolean; keys: Record<string, string> }> | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000;

async function loadConfigs() {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
  const rows = await db.select().from(integrationsConfig);
  _cache = new Map(rows.map(r => [r.id, { enabled: r.enabled ?? false, keys: (r.keys ?? {}) as Record<string, string> }]));
  _cacheTime = Date.now();
  return _cache;
}

export function invalidateIntegrationCache() { _cache = null; }

/**
 * Check if an integration is enabled.
 * Falls back to env var presence for existing integrations.
 */
export async function isIntegrationEnabled(id: string): Promise<boolean> {
  const configs = await loadConfigs();
  const config = configs.get(id);
  if (config) return config.enabled;

  // Fallback: check env vars for existing integrations
  const ENV_CHECKS: Record<string, string> = {
    shopify: 'SHOPIFY_ADMIN_API_ACCESS_TOKEN',
    clerk: 'CLERK_SECRET_KEY',
    neon: 'DATABASE_URL',
    inngest: 'INNGEST_SIGNING_KEY',
    upstash: 'UPSTASH_REDIS_REST_URL',
    square: 'SQUARE_ACCESS_TOKEN',
    anthropic: 'ANTHROPIC_API_KEY',
    klaviyo: 'KLAVIYO_PRIVATE_KEY',
    posthog: 'NEXT_PUBLIC_POSTHOG_KEY',
    polar: 'NEXT_PUBLIC_POLAR_SITE_ID',
    yotpo: 'YOTPO_APP_KEY',
  };

  return !!process.env[ENV_CHECKS[id] ?? ''];
}

/**
 * Get a key for an integration. Checks DB first, falls back to env var.
 * Returns null if not configured.
 */
export async function getIntegrationKey(id: string, keyName: string): Promise<string | null> {
  const configs = await loadConfigs();
  const config = configs.get(id);
  if (config?.keys[keyName]) return config.keys[keyName];
  return process.env[keyName] ?? null;
}
