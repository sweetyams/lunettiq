#!/usr/bin/env tsx
/**
 * One-time script: Create customer metafield definitions in Shopify.
 * Run with: npx tsx scripts/create-customer-metafields.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API = `https://${SHOP}/admin/api/2024-01/graphql.json`;

const DEFINITIONS = [
  { key: 'prescriptions', name: 'Prescriptions', type: 'json' },
  { key: 'wishlist', name: 'Wishlist', type: 'json' },
  { key: 'loyalty', name: 'Loyalty', type: 'json' },
];

const MUTATION = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name key }
      userErrors { field message }
    }
  }
`;

async function main() {
  if (!SHOP || !TOKEN) { console.error('Missing SHOP or TOKEN env vars'); process.exit(1); }

  for (const def of DEFINITIONS) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
      body: JSON.stringify({
        query: MUTATION,
        variables: {
          definition: {
            name: def.name,
            namespace: 'custom',
            key: def.key,
            type: def.type,
            ownerType: 'CUSTOMER',
            pin: true,
          },
        },
      }),
    });

    const json = await res.json();
    const result = json.data?.metafieldDefinitionCreate;
    if (result?.createdDefinition) {
      console.log(`✓ ${def.name} (${def.key})`);
    } else {
      const errors = result?.userErrors ?? json.errors ?? [];
      const msg = errors.map((e: any) => e.message).join(', ');
      if (msg.includes('already exists')) {
        console.log(`· ${def.name} (${def.key}) — already exists`);
      } else {
        console.error(`✗ ${def.name} (${def.key}): ${msg}`);
      }
    }
  }

  console.log('\nDone.');
}

main();
