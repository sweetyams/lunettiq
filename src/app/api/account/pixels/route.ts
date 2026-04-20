export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getIntegrationKey, isIntegrationEnabled } from '@/lib/crm/integrations';

/**
 * Public pixel config endpoint.
 * Returns non-secret pixel IDs from DB (or env var fallback).
 * Called by TrackingPixels client component on mount.
 * 
 * Cache: CDN-cacheable for 60s, stale-while-revalidate for 300s.
 */

const PIXEL_KEYS = [
  { integration: 'polar', key: 'NEXT_PUBLIC_POLAR_SITE_ID' },
  { integration: 'posthog', key: 'NEXT_PUBLIC_POSTHOG_KEY' },
  { integration: 'posthog', key: 'NEXT_PUBLIC_POSTHOG_HOST' },
  { integration: 'meta_pixel', key: 'NEXT_PUBLIC_META_PIXEL_ID' },
  { integration: 'tiktok_pixel', key: 'NEXT_PUBLIC_TIKTOK_PIXEL_ID' },
  { integration: 'google_analytics', key: 'NEXT_PUBLIC_GA4_ID' },
  { integration: 'pinterest_tag', key: 'NEXT_PUBLIC_PINTEREST_TAG_ID' },
  { integration: 'snapchat_pixel', key: 'NEXT_PUBLIC_SNAPCHAT_PIXEL_ID' },
] as const;

export async function GET() {
  const data: Record<string, string> = {};

  await Promise.all(PIXEL_KEYS.map(async ({ integration, key }) => {
    const enabled = await isIntegrationEnabled(integration);
    if (!enabled) return;
    const value = await getIntegrationKey(integration, key);
    if (value) data[key] = value;
  }));

  return NextResponse.json({ data }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
