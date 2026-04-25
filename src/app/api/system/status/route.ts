export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { integrationsConfig } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

interface Status { id: string; name: string; status: 'ok' | 'error' | 'off'; detail?: string }

async function check(id: string, name: string, fn: () => Promise<string>): Promise<Status> {
  try {
    const detail = await fn();
    return { id, name, status: 'ok', detail };
  } catch (e: any) {
    return { id, name, status: 'error', detail: e.message?.slice(0, 80) };
  }
}

// Resolve a key: check integrations_config DB table first, then env var
async function resolveKey(keyName: string, dbConfigs: Map<string, Record<string, string>>): Promise<string | null> {
  const KEY_MAP: Record<string, string> = {
    SHOPIFY_ADMIN_API_ACCESS_TOKEN: 'shopify', NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN: 'shopify',
    SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'shopify', SQUARE_ACCESS_TOKEN: 'square',
    CLERK_SECRET_KEY: 'clerk', INNGEST_SIGNING_KEY: 'inngest', INNGEST_EVENT_KEY: 'inngest',
    ANTHROPIC_API_KEY: 'anthropic', KLAVIYO_PRIVATE_KEY: 'klaviyo',
    UPSTASH_REDIS_REST_URL: 'upstash', UPSTASH_REDIS_REST_TOKEN: 'upstash',
    NEXT_PUBLIC_POSTHOG_KEY: 'posthog', NEXT_PUBLIC_POLAR_SITE_ID: 'polar',
    NEXT_PUBLIC_GA4_ID: 'google_analytics', NEXT_PUBLIC_META_PIXEL_ID: 'meta_pixel',
    NEXT_PUBLIC_TIKTOK_PIXEL_ID: 'tiktok_pixel', NEXT_PUBLIC_PINTEREST_TAG_ID: 'pinterest_tag',
    NEXT_PUBLIC_SNAPCHAT_PIXEL_ID: 'snapchat_pixel',
  };
  const integrationId = KEY_MAP[keyName];
  if (integrationId) {
    const keys = dbConfigs.get(integrationId);
    if (keys?.[keyName]) return keys[keyName];
  }
  return process.env[keyName] ?? null;
}

export async function GET() {
  const statuses: Status[] = [];

  // Load all integration configs from DB in one query (bypass the module cache)
  let dbConfigs = new Map<string, Record<string, string>>();
  try {
    const rows = await db.select().from(integrationsConfig);
    dbConfigs = new Map(rows.filter(r => r.enabled).map(r => [r.id, (r.keys ?? {}) as Record<string, string>]));
  } catch {}

  // Helper
  const key = (name: string) => resolveKey(name, dbConfigs);

  // ── Database ──
  statuses.push(await check('neon', 'Neon Postgres', async () => {
    const r = await db.execute(sql`SELECT count(*) as c FROM integrations_config`);
    return `Connected · ${(r.rows[0] as any)?.c ?? 0} integrations configured`;
  }));

  // ── Shopify Storefront ──
  const shopDomain = await key('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN');
  const sfToken = await key('SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  if (sfToken && shopDomain) {
    statuses.push(await check('shopify_storefront', 'Shopify Storefront API', async () => {
      const res = await fetch(`https://${shopDomain}/api/2024-10/graphql.json`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Shopify-Storefront-Private-Token': sfToken },
        body: JSON.stringify({ query: '{ shop { name } }' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return d.data?.shop?.name ?? 'Connected';
    }));
  } else statuses.push({ id: 'shopify_storefront', name: 'Shopify Storefront API', status: 'off', detail: 'No token or domain' });

  // ── Shopify Admin ──
  const adminToken = await key('SHOPIFY_ADMIN_API_ACCESS_TOKEN');
  if (adminToken && shopDomain) {
    statuses.push(await check('shopify_admin', 'Shopify Admin API', async () => {
      const res = await fetch(`https://${shopDomain}/admin/api/2024-04/shop.json`, {
        headers: { 'X-Shopify-Access-Token': adminToken },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return d.shop?.name ?? 'Connected';
    }));
  } else statuses.push({ id: 'shopify_admin', name: 'Shopify Admin API', status: 'off', detail: 'No token' });

  // ── Shopify Webhooks ──
  if (adminToken && shopDomain) {
    statuses.push(await check('shopify_webhooks', 'Shopify Webhooks', async () => {
      const res = await fetch(`https://${shopDomain}/admin/api/2024-04/webhooks.json`, {
        headers: { 'X-Shopify-Access-Token': adminToken },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const topics = (d.webhooks ?? []).map((w: any) => w.topic);
      const required = ['orders/create', 'orders/updated', 'products/update', 'customers/create', 'customers/update'];
      const missing = required.filter(t => !topics.includes(t));
      if (missing.length) throw new Error(`${topics.length} registered, missing: ${missing.join(', ')}`);
      return `${topics.length} registered`;
    }));
  }

  // ── Clerk ──
  const clerkKey = await key('CLERK_SECRET_KEY');
  if (clerkKey) {
    statuses.push(await check('clerk', 'Clerk Auth', async () => {
      const res = await fetch('https://api.clerk.com/v1/users?limit=1', { headers: { Authorization: `Bearer ${clerkKey}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'Connected';
    }));
  } else statuses.push({ id: 'clerk', name: 'Clerk Auth', status: 'off', detail: 'No secret key' });

  // ── Inngest ──
  const inngestSigning = await key('INNGEST_SIGNING_KEY');
  const inngestEvent = await key('INNGEST_EVENT_KEY');
  if (inngestSigning) {
    statuses.push({ id: 'inngest', name: 'Inngest', status: 'ok', detail: 'Cloud configured' });
  } else {
    try {
      const r = await fetch('http://127.0.0.1:8288/v0/health', { signal: AbortSignal.timeout(1000) });
      statuses.push({ id: 'inngest', name: 'Inngest', status: r.ok ? 'ok' : 'error', detail: r.ok ? 'Dev server running' : 'Dev server error' });
    } catch {
      statuses.push({ id: 'inngest', name: 'Inngest', status: inngestEvent ? 'ok' : 'off', detail: inngestEvent ? 'Event key only' : 'Not configured' });
    }
  }

  // ── Square ──
  const squareToken = await key('SQUARE_ACCESS_TOKEN');
  const sqEnv = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
  const sqBase = sqEnv === 'production' ? 'https://connect.squareup.com/v2' : 'https://connect.squareupsandbox.com/v2';
  if (squareToken) {
    statuses.push(await check('square', 'Square POS', async () => {
      const res = await fetch(`${sqBase}/locations`, { headers: { Authorization: `Bearer ${squareToken}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return `${sqEnv} · ${d.locations?.length ?? 0} locations`;
    }));
    statuses.push(await check('square_webhooks', 'Square Webhooks', async () => {
      const res = await fetch(`${sqBase}/webhooks/subscriptions`, {
        headers: { Authorization: `Bearer ${squareToken}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const subs = d.subscriptions ?? [];
      if (!subs.length) throw new Error('No subscriptions — run register-square-webhooks.mjs');
      return `${subs.length} subscription · ${subs.flatMap((s: any) => s.event_types ?? []).length} events`;
    }));
  } else {
    statuses.push({ id: 'square', name: 'Square POS', status: 'off', detail: 'No access token' });
    statuses.push({ id: 'square_webhooks', name: 'Square Webhooks', status: 'off', detail: 'No access token' });
  }

  // ── Anthropic ──
  const anthropicKey = await key('ANTHROPIC_API_KEY');
  if (anthropicKey) {
    statuses.push(await check('anthropic', 'Anthropic (Claude)', async () => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      if (res.status === 401) throw new Error('Invalid API key');
      if (res.status === 429) return 'Connected (rate limited)';
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'Connected';
    }));
  } else statuses.push({ id: 'anthropic', name: 'Anthropic (Claude)', status: 'off', detail: 'No API key' });

  // ── Upstash Redis ──
  const upstashUrl = await key('UPSTASH_REDIS_REST_URL');
  const upstashToken = await key('UPSTASH_REDIS_REST_TOKEN');
  if (upstashUrl && upstashToken) {
    statuses.push(await check('upstash', 'Upstash Redis', async () => {
      const res = await fetch(`${upstashUrl}/ping`, { headers: { Authorization: `Bearer ${upstashToken}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'Connected';
    }));
  } else statuses.push({ id: 'upstash', name: 'Upstash Redis', status: 'off', detail: 'Not configured (optional)' });

  // ── Klaviyo ──
  const klaviyoKey = await key('KLAVIYO_PRIVATE_KEY');
  if (klaviyoKey) {
    statuses.push(await check('klaviyo', 'Klaviyo', async () => {
      const res = await fetch('https://a.klaviyo.com/api/accounts/', {
        headers: { Authorization: `Klaviyo-API-Key ${klaviyoKey}`, revision: '2024-02-15' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return 'Connected';
    }));
  } else statuses.push({ id: 'klaviyo', name: 'Klaviyo', status: 'off', detail: 'No API key' });

  // ── Tracking Pixels (key-exists only, no API to ping) ──
  const pixels: Array<{ id: string; name: string; keyName: string }> = [
    { id: 'posthog', name: 'PostHog', keyName: 'NEXT_PUBLIC_POSTHOG_KEY' },
    { id: 'polar', name: 'Polar Analytics', keyName: 'NEXT_PUBLIC_POLAR_SITE_ID' },
    { id: 'ga4', name: 'Google Analytics 4', keyName: 'NEXT_PUBLIC_GA4_ID' },
    { id: 'meta_pixel', name: 'Meta Pixel', keyName: 'NEXT_PUBLIC_META_PIXEL_ID' },
    { id: 'tiktok', name: 'TikTok Pixel', keyName: 'NEXT_PUBLIC_TIKTOK_PIXEL_ID' },
    { id: 'pinterest', name: 'Pinterest Tag', keyName: 'NEXT_PUBLIC_PINTEREST_TAG_ID' },
    { id: 'snapchat', name: 'Snapchat Pixel', keyName: 'NEXT_PUBLIC_SNAPCHAT_PIXEL_ID' },
  ];
  for (const p of pixels) {
    const v = await key(p.keyName);
    statuses.push({ id: p.id, name: p.name, status: v ? 'ok' : 'off', detail: v ? 'Active' : 'Not set' });
  }

  return NextResponse.json({ data: statuses });
}
