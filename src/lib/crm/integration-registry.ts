/**
 * Integration Registry — single source of truth for all integrations.
 * Each integration defines: id, name, description, required keys, tags, setup docs.
 * Keys are stored encrypted in the DB, never in env vars (except existing ones during migration).
 */

export interface IntegrationDef {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or URL
  tags: ('storefront' | 'crm' | 'backend' | 'analytics' | 'marketing' | 'payments' | 'pos' | 'auth')[];
  requiredKeys: { key: string; label: string; placeholder: string; secret: boolean }[];
  docsUrl: string;
  setupSteps: string[];
  category: 'commerce' | 'marketing' | 'analytics' | 'payments' | 'operations' | 'auth';
}

export const INTEGRATIONS: IntegrationDef[] = [
  // ─── Existing (already wired) ──────────────────────────
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Source of truth for products, orders, customers. Storefront API + Admin API + webhooks.',
    icon: '🛍️',
    tags: ['storefront', 'backend'],
    category: 'commerce',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN', label: 'Store Domain', placeholder: 'store.myshopify.com', secret: false },
      { key: 'SHOPIFY_STOREFRONT_ACCESS_TOKEN', label: 'Storefront Token', placeholder: 'shpat_...', secret: true },
      { key: 'SHOPIFY_ADMIN_API_ACCESS_TOKEN', label: 'Admin API Token', placeholder: 'shpca_...', secret: true },
      { key: 'SHOPIFY_WEBHOOK_SECRET', label: 'Webhook HMAC Secret', placeholder: 'shpss_...', secret: true },
    ],
    docsUrl: 'https://shopify.dev/docs/api',
    setupSteps: ['Create a custom app in Shopify Admin → Settings → Apps', 'Grant read/write access to products, customers, orders', 'Copy the API tokens', 'Register webhooks via scripts/register-webhooks.mjs'],
  },
  {
    id: 'clerk',
    name: 'Clerk',
    description: 'Staff authentication for the CRM. Handles login, sessions, role-based access.',
    icon: '🔐',
    tags: ['crm', 'auth'],
    category: 'auth',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', label: 'Publishable Key', placeholder: 'pk_test_...', secret: false },
      { key: 'CLERK_SECRET_KEY', label: 'Secret Key', placeholder: 'sk_test_...', secret: true },
    ],
    docsUrl: 'https://clerk.com/docs',
    setupSteps: ['Create a Clerk application at clerk.com', 'Copy publishable + secret keys', 'Set up staff roles via publicMetadata'],
  },
  {
    id: 'neon',
    name: 'Neon (Postgres)',
    description: 'Serverless Postgres. Stores projection tables, CRM data, credits, interactions.',
    icon: '🐘',
    tags: ['backend'],
    category: 'operations',
    requiredKeys: [
      { key: 'DATABASE_URL', label: 'Connection String', placeholder: 'postgresql://...', secret: true },
    ],
    docsUrl: 'https://neon.tech/docs',
    setupSteps: ['Create a Neon project', 'Copy the pooled connection string', 'Run npx drizzle-kit push to create tables'],
  },
  {
    id: 'inngest',
    name: 'Inngest',
    description: 'Background job processing. Handles webhook events, cron jobs, membership activation.',
    icon: '⚡',
    tags: ['backend'],
    category: 'operations',
    requiredKeys: [
      { key: 'INNGEST_EVENT_KEY', label: 'Event Key', placeholder: '', secret: true },
      { key: 'INNGEST_SIGNING_KEY', label: 'Signing Key', placeholder: 'signkey-...', secret: true },
    ],
    docsUrl: 'https://www.inngest.com/docs',
    setupSteps: ['Create an Inngest account', 'Sync your app at /api/inngest', 'Copy event key + signing key'],
  },
  {
    id: 'upstash',
    name: 'Upstash Redis',
    description: 'Serverless Redis for caching and rate limiting.',
    icon: '🔴',
    tags: ['backend'],
    category: 'operations',
    requiredKeys: [
      { key: 'UPSTASH_REDIS_REST_URL', label: 'REST URL', placeholder: 'https://...upstash.io', secret: false },
      { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'REST Token', placeholder: '', secret: true },
    ],
    docsUrl: 'https://upstash.com/docs/redis',
    setupSteps: ['Create an Upstash Redis database', 'Copy REST URL + token'],
  },
  {
    id: 'square',
    name: 'Square POS',
    description: 'In-store point of sale. Read-only sync of orders and customers from physical retail.',
    icon: '⬛',
    tags: ['backend', 'pos'],
    category: 'commerce',
    requiredKeys: [
      { key: 'SQUARE_APPLICATION_ID', label: 'Application ID', placeholder: 'sq0idp-...', secret: false },
      { key: 'SQUARE_ACCESS_TOKEN', label: 'Access Token', placeholder: 'EAA...', secret: true },
      { key: 'SQUARE_WEBHOOK_SIGNATURE_KEY', label: 'Webhook Signature', placeholder: '', secret: true },
    ],
    docsUrl: 'https://developer.squareup.com/docs',
    setupSteps: ['Create a Square app at developer.squareup.com', 'Switch to Production credentials', 'Copy application ID + access token', 'Register webhook URL'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'AI-powered features: client styler, segment suggestions, product analysis.',
    icon: '🧠',
    tags: ['crm', 'backend'],
    category: 'operations',
    requiredKeys: [
      { key: 'ANTHROPIC_API_KEY', label: 'API Key', placeholder: 'sk-ant-...', secret: true },
    ],
    docsUrl: 'https://docs.anthropic.com',
    setupSteps: ['Create an Anthropic account at console.anthropic.com', 'Generate an API key', 'Daily budget enforced in app ($5/day default)'],
  },

  // ─── New (to be wired) ─────────────────────────────────
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'Email & SMS marketing. Transactional flows, segment campaigns, post-purchase sequences.',
    icon: '📧',
    tags: ['marketing', 'storefront', 'backend'],
    category: 'marketing',
    requiredKeys: [
      { key: 'KLAVIYO_API_KEY', label: 'Public API Key', placeholder: '', secret: false },
      { key: 'KLAVIYO_PRIVATE_KEY', label: 'Private API Key', placeholder: 'pk_...', secret: true },
    ],
    docsUrl: 'https://developers.klaviyo.com',
    setupSteps: ['Create a Klaviyo account', 'Connect Shopify via Klaviyo\'s native integration', 'Generate API keys in Account → Settings → API Keys', 'Build flows: membership welcome, credit reminders, Rx expiry'],
  },
  {
    id: 'posthog',
    name: 'PostHog',
    description: 'Product analytics, session recordings, feature flags. Privacy-first alternative to GA.',
    icon: '🦔',
    tags: ['analytics', 'storefront'],
    category: 'analytics',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_POSTHOG_KEY', label: 'Project API Key', placeholder: 'phc_...', secret: false },
      { key: 'NEXT_PUBLIC_POSTHOG_HOST', label: 'Host URL', placeholder: 'https://app.posthog.com', secret: false },
    ],
    docsUrl: 'https://posthog.com/docs',
    setupSteps: ['Create a PostHog project', 'Copy the project API key', 'Cookie consent banner required before init (Law 25)'],
  },
  {
    id: 'polar',
    name: 'Polar Analytics',
    description: 'Cookieless Shopify analytics. Revenue, conversion, attribution without cookies. GDPR/Law 25 compliant.',
    icon: '📊',
    tags: ['analytics', 'storefront'],
    category: 'analytics',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_POLAR_SITE_ID', label: 'Site ID', placeholder: '', secret: false },
    ],
    docsUrl: 'https://docs.polaranalytics.com',
    setupSteps: ['Create a Polar Analytics account', 'Connect Shopify store (one-click)', 'Copy Site ID from Settings → Tracking', 'No consent banner needed — cookieless'],
  },
  {
    id: 'meta_pixel',
    name: 'Meta Pixel',
    description: 'Facebook & Instagram conversion tracking. Requires cookie consent (Law 25).',
    icon: '📘',
    tags: ['analytics', 'marketing', 'storefront'],
    category: 'marketing',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_META_PIXEL_ID', label: 'Pixel ID', placeholder: '123456789', secret: false },
    ],
    docsUrl: 'https://developers.facebook.com/docs/meta-pixel',
    setupSteps: ['Go to Meta Events Manager', 'Create a pixel or use existing', 'Copy the Pixel ID', 'Requires cookie consent before firing'],
  },
  {
    id: 'tiktok_pixel',
    name: 'TikTok Pixel',
    description: 'TikTok ad conversion tracking. Requires cookie consent.',
    icon: '🎵',
    tags: ['analytics', 'marketing', 'storefront'],
    category: 'marketing',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_TIKTOK_PIXEL_ID', label: 'Pixel ID', placeholder: '', secret: false },
    ],
    docsUrl: 'https://ads.tiktok.com/help/article/get-started-pixel',
    setupSteps: ['Go to TikTok Ads Manager → Events', 'Create a pixel', 'Copy the Pixel ID'],
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    description: 'GA4 web analytics. Requires cookie consent.',
    icon: '📈',
    tags: ['analytics', 'storefront'],
    category: 'analytics',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_GA4_ID', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', secret: false },
    ],
    docsUrl: 'https://support.google.com/analytics/answer/9304153',
    setupSteps: ['Create a GA4 property', 'Copy the Measurement ID (G-XXXX)', 'Requires cookie consent'],
  },
  {
    id: 'pinterest_tag',
    name: 'Pinterest Tag',
    description: 'Pinterest ad conversion tracking. Requires cookie consent.',
    icon: '📌',
    tags: ['analytics', 'marketing', 'storefront'],
    category: 'marketing',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_PINTEREST_TAG_ID', label: 'Tag ID', placeholder: '', secret: false },
    ],
    docsUrl: 'https://help.pinterest.com/en/business/article/install-the-pinterest-tag',
    setupSteps: ['Go to Pinterest Ads → Conversions', 'Create a tag', 'Copy the Tag ID'],
  },
  {
    id: 'snapchat_pixel',
    name: 'Snapchat Pixel',
    description: 'Snapchat ad conversion tracking. Requires cookie consent.',
    icon: '👻',
    tags: ['analytics', 'marketing', 'storefront'],
    category: 'marketing',
    requiredKeys: [
      { key: 'NEXT_PUBLIC_SNAPCHAT_PIXEL_ID', label: 'Pixel ID', placeholder: '', secret: false },
    ],
    docsUrl: 'https://businesshelp.snapchat.com/s/article/snap-pixel-about',
    setupSteps: ['Go to Snap Ads Manager → Events Manager', 'Create a Snap Pixel', 'Copy the Pixel ID'],
  },
  {
    id: 'yotpo',
    name: 'Yotpo',
    description: 'Product reviews & UGC. Star ratings, photo reviews, Q&A on product pages.',
    icon: '⭐',
    tags: ['storefront'],
    category: 'marketing',
    requiredKeys: [
      { key: 'YOTPO_APP_KEY', label: 'App Key', placeholder: '', secret: false },
      { key: 'YOTPO_SECRET_KEY', label: 'Secret Key', placeholder: '', secret: true },
    ],
    docsUrl: 'https://apidocs.yotpo.com',
    setupSteps: ['Create a Yotpo account', 'Install Shopify integration', 'Copy app key + secret', 'Configure review request email timing (14 days post-delivery)'],
  },
];

export function getIntegration(id: string): IntegrationDef | undefined {
  return INTEGRATIONS.find(i => i.id === id);
}

export function getIntegrationsByTag(tag: IntegrationDef['tags'][number]): IntegrationDef[] {
  return INTEGRATIONS.filter(i => i.tags.includes(tag));
}
