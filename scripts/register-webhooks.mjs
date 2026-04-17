/**
 * Register Shopify webhooks.
 * Run: node --env-file=.env.local scripts/register-webhooks.mjs
 */

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

if (!SHOP || !TOKEN) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/register-webhooks.mjs');
  process.exit(1);
}

const API = `https://${SHOP}/admin/api/2024-01`;
const headers = { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' };

// Change this to your Vercel production URL when deploying
const WEBHOOK_URL = process.argv[2] || 'https://lunettiq.vercel.app/api/webhooks/shopify';

const TOPICS = [
  'customers/create',
  'customers/update',
  'orders/create',
  'orders/updated',
  'products/create',
  'products/update',
  'collections/create',
  'collections/update',
];

// First, list existing webhooks
console.log('\n📋 Checking existing webhooks...\n');
const existing = await fetch(`${API}/webhooks.json`, { headers }).then(r => r.json());
for (const wh of existing.webhooks || []) {
  console.log(`  Existing: ${wh.topic} → ${wh.address}`);
}

// Register new ones
console.log(`\n🔗 Registering webhooks → ${WEBHOOK_URL}\n`);

for (const topic of TOPICS) {
  // Check if already registered
  const alreadyExists = (existing.webhooks || []).find(
    w => w.topic === topic && w.address === WEBHOOK_URL
  );
  if (alreadyExists) {
    console.log(`  ⏭  ${topic} — already registered`);
    continue;
  }

  const res = await fetch(`${API}/webhooks.json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      webhook: {
        topic,
        address: WEBHOOK_URL,
        format: 'json',
      },
    }),
  });

  if (res.ok) {
    console.log(`  ✅ ${topic}`);
  } else {
    const err = await res.json();
    console.log(`  ❌ ${topic} — ${JSON.stringify(err.errors || err)}`);
  }
}

console.log('\n✅ Done!\n');
