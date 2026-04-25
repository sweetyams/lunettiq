export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getKey } from '@/lib/crm/integration-keys';

interface Status { id: string; name: string; status: 'ok' | 'error' | 'off'; detail?: string }

async function check(id: string, name: string, fn: () => Promise<string | true>): Promise<Status> {
  try {
    const result = await fn();
    return { id, name, status: 'ok', detail: result === true ? undefined : result };
  } catch (e: any) {
    return { id, name, status: 'error', detail: e.message?.slice(0, 60) };
  }
}

export async function GET() {
  const statuses: Status[] = [];

  // Database
  statuses.push(await check('neon', 'Neon Postgres', async () => {
    await db.execute(sql`SELECT 1`);
    return 'Connected';
  }));

  // Shopify Storefront
  const sfToken = await getKey('SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  const shopDomain = await getKey('NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN');
  if (sfToken && shopDomain) {
    statuses.push(await check('shopify_storefront', 'Shopify Storefront API', async () => {
      const res = await fetch(`https://${shopDomain}/api/2024-10/graphql.json`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Shopify-Storefront-Private-Token': sfToken },
        body: JSON.stringify({ query: '{ shop { name } }' }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return 'Connected';
    }));
  } else statuses.push({ id: 'shopify_storefront', name: 'Shopify Storefront API', status: 'off', detail: 'Not configured' });

  // Shopify Admin
  const adminToken = await getKey('SHOPIFY_ADMIN_API_ACCESS_TOKEN');
  if (adminToken && shopDomain) {
    statuses.push(await check('shopify_admin', 'Shopify Admin API', async () => {
      const res = await fetch(`https://${shopDomain}/admin/api/2024-01/shop.json`, {
        headers: { 'X-Shopify-Access-Token': adminToken },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return 'Connected';
    }));
  } else statuses.push({ id: 'shopify_admin', name: 'Shopify Admin API', status: 'off', detail: 'Not configured' });

  // Clerk
  const clerkKey = await getKey('CLERK_SECRET_KEY');
  if (clerkKey) {
    statuses.push(await check('clerk', 'Clerk Auth', async () => {
      const res = await fetch('https://api.clerk.com/v1/users?limit=1', { headers: { Authorization: `Bearer ${clerkKey}` } });
      if (!res.ok) throw new Error(`${res.status}`);
      return 'Connected';
    }));
  } else statuses.push({ id: 'clerk', name: 'Clerk Auth', status: 'off', detail: 'Not configured' });

  // Square
  const squareToken = await getKey('SQUARE_ACCESS_TOKEN');
  if (squareToken) {
    statuses.push(await check('square', 'Square POS', async () => {
      const res = await fetch('https://connect.squareup.com/v2/locations', { headers: { Authorization: `Bearer ${squareToken}` } });
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      return `${d.locations?.length ?? 0} locations`;
    }));
  } else statuses.push({ id: 'square', name: 'Square POS', status: 'off', detail: 'Not configured' });

  // Shopify Webhooks
  if (adminToken && shopDomain) {
    statuses.push(await check('shopify_webhooks', 'Shopify Webhooks', async () => {
      const res = await fetch(`https://${shopDomain}/admin/api/2024-04/webhooks.json`, {
        headers: { 'X-Shopify-Access-Token': adminToken },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      const count = d.webhooks?.length ?? 0;
      const topics = (d.webhooks ?? []).map((w: any) => w.topic);
      const missing = ['orders/create', 'orders/updated', 'products/update', 'customers/create'].filter(t => !topics.includes(t));
      if (missing.length) return `${count} registered, missing: ${missing.join(', ')}`;
      return `${count} registered`;
    }));
  }

  // Square Webhooks
  if (squareToken) {
    statuses.push(await check('square_webhooks', 'Square Webhooks', async () => {
      const sqEnv = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
      const sqBase = sqEnv === 'production' ? 'https://connect.squareup.com/v2' : 'https://connect.squareupsandbox.com/v2';
      const res = await fetch(`${sqBase}/webhooks/subscriptions`, {
        headers: { 'Authorization': `Bearer ${squareToken}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const d = await res.json();
      const subs = d.subscriptions ?? [];
      if (!subs.length) throw new Error('No subscriptions registered');
      const events = subs.flatMap((s: any) => s.event_types ?? []);
      return `${subs.length} sub, ${events.length} events`;
    }));
  }

  // Inngest
  const inngestKey = await getKey('INNGEST_SIGNING_KEY');
  statuses.push({ id: 'inngest', name: 'Inngest', status: inngestKey ? 'ok' : 'off', detail: inngestKey ? 'Configured' : 'Not configured' });

  // Anthropic
  const anthropicKey = await getKey('ANTHROPIC_API_KEY');
  statuses.push({ id: 'anthropic', name: 'Anthropic (Claude)', status: anthropicKey ? 'ok' : 'off', detail: anthropicKey ? 'Key set' : 'Not configured' });

  // Pixels
  const posthogKey = await getKey('NEXT_PUBLIC_POSTHOG_KEY');
  const polarId = await getKey('NEXT_PUBLIC_POLAR_SITE_ID');
  const metaId = await getKey('NEXT_PUBLIC_META_PIXEL_ID');
  const tiktokId = await getKey('NEXT_PUBLIC_TIKTOK_PIXEL_ID');
  const ga4Id = await getKey('NEXT_PUBLIC_GA4_ID');
  const pinterestId = await getKey('NEXT_PUBLIC_PINTEREST_TAG_ID');
  const snapchatId = await getKey('NEXT_PUBLIC_SNAPCHAT_PIXEL_ID');

  statuses.push({ id: 'polar', name: 'Polar Analytics', status: polarId ? 'ok' : 'off', detail: polarId ? 'Pixel active' : 'No Site ID' });
  statuses.push({ id: 'posthog', name: 'PostHog', status: posthogKey ? 'ok' : 'off', detail: posthogKey ? 'Pixel active' : 'No key' });
  statuses.push({ id: 'meta_pixel', name: 'Meta Pixel', status: metaId ? 'ok' : 'off', detail: metaId ? 'Pixel active' : 'No Pixel ID' });
  statuses.push({ id: 'tiktok', name: 'TikTok Pixel', status: tiktokId ? 'ok' : 'off', detail: tiktokId ? 'Pixel active' : 'No Pixel ID' });
  statuses.push({ id: 'ga4', name: 'Google Analytics 4', status: ga4Id ? 'ok' : 'off', detail: ga4Id ? 'Tracking active' : 'No Measurement ID' });
  statuses.push({ id: 'pinterest', name: 'Pinterest Tag', status: pinterestId ? 'ok' : 'off', detail: pinterestId ? 'Tag active' : 'No Tag ID' });
  statuses.push({ id: 'snapchat', name: 'Snapchat Pixel', status: snapchatId ? 'ok' : 'off', detail: snapchatId ? 'Pixel active' : 'No Pixel ID' });

  // Upstash
  const upstashUrl = await getKey('UPSTASH_REDIS_REST_URL');
  statuses.push({ id: 'upstash', name: 'Upstash Redis', status: upstashUrl ? 'ok' : 'off', detail: upstashUrl ? 'Configured' : 'Not configured' });

  // Klaviyo
  const klaviyoKey = await getKey('KLAVIYO_PRIVATE_KEY');
  statuses.push({ id: 'klaviyo', name: 'Klaviyo', status: klaviyoKey ? 'ok' : 'off', detail: klaviyoKey ? 'Connected' : 'Not configured' });

  return NextResponse.json({ data: statuses });
}
