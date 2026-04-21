/**
 * Store settings — configurable values that were previously hardcoded.
 * Reads from DB with in-memory cache (60s). Falls back to defaults.
 */

import { db } from '@/lib/db';
import { storeSettings } from '@/lib/db/schema';

const DEFAULTS: Record<string, string> = {
  timezone: 'America/Montreal',
  shopify_api_version: '2024-10',
  shopify_admin_api_version: '2024-01',
  auto_family_min_items: '4',
  frame_size_small_max: '128',
  frame_size_medium_max: '138',
  membership_sku_essential_monthly: 'MEMBERSHIP-ESSENTIAL-MONTHLY',
  membership_sku_essential_annual: 'MEMBERSHIP-ESSENTIAL-ANNUAL',
  membership_sku_cult_monthly: 'MEMBERSHIP-CULT-MONTHLY',
  membership_sku_cult_annual: 'MEMBERSHIP-CULT-ANNUAL',
  membership_sku_vault_monthly: 'MEMBERSHIP-VAULT-MONTHLY',
  membership_sku_vault_annual: 'MEMBERSHIP-VAULT-ANNUAL',
  loyalty_tag_prefix: 'member-',
  loyalty_tiers: 'essential,cult,vault',
};

let _cache: Map<string, string> | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000;

async function loadSettings(): Promise<Map<string, string>> {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
  const rows = await db.select().from(storeSettings);
  _cache = new Map(Object.entries(DEFAULTS));
  for (const r of rows) _cache.set(r.key, r.value);
  _cacheTime = Date.now();
  return _cache;
}

export function invalidateSettingsCache() { _cache = null; }

/** Get a single setting value. */
export async function getSetting(key: string): Promise<string> {
  const settings = await loadSettings();
  return settings.get(key) ?? DEFAULTS[key] ?? '';
}

/** Get multiple settings at once. */
export async function getSettings(...keys: string[]): Promise<Record<string, string>> {
  const settings = await loadSettings();
  const result: Record<string, string> = {};
  for (const k of keys) result[k] = settings.get(k) ?? DEFAULTS[k] ?? '';
  return result;
}

/** Get all settings (for the settings UI). */
export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await loadSettings();
  return Object.fromEntries(settings);
}

/** Get timezone (most commonly needed). */
export async function getTimezone(): Promise<string> {
  return getSetting('timezone');
}

/** Get membership SKU map. */
export async function getMembershipSkus(): Promise<Record<string, { tier: string; period: 'monthly' | 'annual' }>> {
  const settings = await loadSettings();
  const result: Record<string, { tier: string; period: 'monthly' | 'annual' }> = {};
  for (const [key, value] of settings) {
    const match = key.match(/^membership_sku_(\w+)_(monthly|annual)$/);
    if (match) result[value] = { tier: match[1], period: match[2] as 'monthly' | 'annual' };
  }
  return result;
}

/** Get frame size thresholds. */
export async function getSizeThresholds(): Promise<{ smallMax: number; mediumMax: number }> {
  const s = await getSettings('frame_size_small_max', 'frame_size_medium_max');
  return { smallMax: Number(s.frame_size_small_max), mediumMax: Number(s.frame_size_medium_max) };
}
