/**
 * Register Square webhook subscription.
 * Run: node --env-file=.env.local scripts/register-square-webhooks.mjs [url]
 *
 * Requires SQUARE_ACCESS_TOKEN and SQUARE_ENVIRONMENT in env.
 * URL defaults to SQUARE_WEBHOOK_URL env var, then lunettiq.vercel.app.
 * 
 * Square validates the URL is reachable — deploy first.
 */

const token = process.env.SQUARE_ACCESS_TOKEN;
const env = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
const base = env === 'production' ? 'https://connect.squareup.com/v2' : 'https://connect.squareupsandbox.com/v2';
const webhookUrl = process.argv[2] || 'https://lunettiq.vercel.app/api/webhooks/square';

if (!token) { console.error('Missing SQUARE_ACCESS_TOKEN'); process.exit(1); }

console.log(`\n📋 Square Webhooks (${env})\n`);
console.log(`   URL: ${webhookUrl}\n`);

// List existing
const existing = await fetch(`${base}/webhooks/subscriptions`, {
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
}).then(r => r.json());

if (existing.subscriptions?.length) {
  console.log('Existing subscriptions:');
  for (const s of existing.subscriptions) {
    console.log(`  ${s.name} → ${s.notification_url}`);
    console.log(`    Events: ${s.event_types?.join(', ')}`);
    console.log(`    Enabled: ${s.enabled}`);
  }
  console.log('\n⏭  Already has subscriptions. Delete existing first if you want to re-register.\n');
  process.exit(0);
}

// Register
console.log('🔗 Registering webhook subscription...\n');

const res = await fetch(`${base}/webhooks/subscriptions`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Square-Version': '2024-10-17' },
  body: JSON.stringify({
    idempotency_key: `lunettiq-webhooks-${Date.now()}`,
    subscription: {
      name: 'Lunettiq CRM',
      notification_url: webhookUrl,
      event_types: [
        'order.created',
        'order.updated',
        'payment.completed',
        'customer.created',
        'customer.updated',
      ],
      api_version: '2024-10-17',
    },
  }),
});

const d = await res.json();
if (d.subscription) {
  console.log('✅ Registered!');
  console.log(`   Name: ${d.subscription.name}`);
  console.log(`   URL: ${d.subscription.notification_url}`);
  console.log(`   Events: ${d.subscription.event_types?.join(', ')}`);
  if (d.subscription.signature_key) {
    console.log(`\n⚠️  Signature key: ${d.subscription.signature_key}`);
    console.log('   Save this as SQUARE_WEBHOOK_SIGNATURE_KEY in your env vars!\n');
  }
} else {
  console.log('❌ Failed:');
  console.log(JSON.stringify(d.errors || d, null, 2));
  if (d.errors?.[0]?.code === 'UNREACHABLE_URL') {
    console.log('\n💡 Square validates the URL is reachable. Make sure:');
    console.log('   1. The app is deployed to Vercel');
    console.log('   2. The GET handler returns 200 (added in webhooks/square/route.ts)');
    console.log('   3. The URL is correct\n');
  }
}
