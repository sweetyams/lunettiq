import { describe, it, expect } from 'vitest';

describe('resolveKey — DB-first, env-fallback', () => {
  // Simulates the resolveKey logic from the status API
  function resolveKey(
    keyName: string,
    dbConfigs: Map<string, Record<string, string>>,
    envVars: Record<string, string>
  ): string | null {
    const KEY_MAP: Record<string, string> = {
      ANTHROPIC_API_KEY: 'anthropic',
      SQUARE_ACCESS_TOKEN: 'square',
      CLERK_SECRET_KEY: 'clerk',
      SHOPIFY_ADMIN_API_ACCESS_TOKEN: 'shopify',
    };
    const integrationId = KEY_MAP[keyName];
    if (integrationId) {
      const keys = dbConfigs.get(integrationId);
      if (keys?.[keyName]) return keys[keyName];
    }
    return envVars[keyName] ?? null;
  }

  it('returns DB value when present', () => {
    const db = new Map([['anthropic', { ANTHROPIC_API_KEY: 'sk-db-key' }]]);
    expect(resolveKey('ANTHROPIC_API_KEY', db, {})).toBe('sk-db-key');
  });

  it('falls back to env when DB has no row', () => {
    const db = new Map<string, Record<string, string>>();
    expect(resolveKey('ANTHROPIC_API_KEY', db, { ANTHROPIC_API_KEY: 'sk-env-key' })).toBe('sk-env-key');
  });

  it('DB takes priority over env', () => {
    const db = new Map([['anthropic', { ANTHROPIC_API_KEY: 'sk-db' }]]);
    expect(resolveKey('ANTHROPIC_API_KEY', db, { ANTHROPIC_API_KEY: 'sk-env' })).toBe('sk-db');
  });

  it('returns null when neither DB nor env has key', () => {
    expect(resolveKey('ANTHROPIC_API_KEY', new Map(), {})).toBeNull();
  });

  it('returns null for empty string in DB', () => {
    const db = new Map([['anthropic', { ANTHROPIC_API_KEY: '' }]]);
    expect(resolveKey('ANTHROPIC_API_KEY', db, {})).toBeNull();
  });

  it('handles unknown key names via env only', () => {
    expect(resolveKey('SOME_RANDOM_KEY', new Map(), { SOME_RANDOM_KEY: 'val' })).toBe('val');
  });

  it('handles unknown key names with no env', () => {
    expect(resolveKey('SOME_RANDOM_KEY', new Map(), {})).toBeNull();
  });
});

describe('status grouping', () => {
  const GROUPS = [
    { label: 'Core', ids: ['neon', 'clerk', 'inngest', 'upstash'] },
    { label: 'Shopify', ids: ['shopify_storefront', 'shopify_admin', 'shopify_webhooks'] },
    { label: 'Square', ids: ['square', 'square_webhooks'] },
    { label: 'Services', ids: ['anthropic', 'klaviyo'] },
    { label: 'Tracking', ids: ['posthog', 'polar', 'ga4', 'meta_pixel', 'tiktok', 'pinterest', 'snapchat'] },
  ];

  it('every status ID belongs to exactly one group', () => {
    const allIds = GROUPS.flatMap(g => g.ids);
    const unique = new Set(allIds);
    expect(allIds.length).toBe(unique.size); // no duplicates
  });

  it('covers all expected services', () => {
    const allIds = GROUPS.flatMap(g => g.ids);
    const expected = ['neon', 'clerk', 'inngest', 'upstash', 'shopify_storefront', 'shopify_admin',
      'shopify_webhooks', 'square', 'square_webhooks', 'anthropic', 'klaviyo',
      'posthog', 'polar', 'ga4', 'meta_pixel', 'tiktok', 'pinterest', 'snapchat'];
    for (const id of expected) {
      expect(allIds).toContain(id);
    }
  });

  it('no empty groups', () => {
    for (const g of GROUPS) {
      expect(g.ids.length).toBeGreaterThan(0);
    }
  });
});
