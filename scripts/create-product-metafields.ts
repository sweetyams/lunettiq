#!/usr/bin/env tsx
/**
 * One-time script: Create product metafield definitions in Shopify.
 * Run with: npx tsx scripts/create-product-metafields.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API = `https://${SHOP}/admin/api/2024-01/graphql.json`;

const DEFINITIONS = [
  { key: 'frame_width', name: 'Frame Width', type: 'number_integer' },
  { key: 'lens_width', name: 'Lens Width', type: 'number_integer' },
  { key: 'lens_height', name: 'Lens Height', type: 'number_integer' },
  { key: 'bridge_width', name: 'Bridge Width', type: 'number_integer' },
  { key: 'temple_length', name: 'Temple Length', type: 'number_integer' },
  { key: 'material', name: 'Material', type: 'single_line_text_field' },
  { key: 'acetate_source', name: 'Acetate', type: 'single_line_text_field' },
  { key: 'hinge_type', name: 'Hinge', type: 'single_line_text_field' },
  { key: 'lens_coating', name: 'Lens Coating', type: 'single_line_text_field' },
  { key: 'uv_protection', name: 'UV Protection', type: 'single_line_text_field' },
  { key: 'included_accessories', name: 'Included', type: 'single_line_text_field' },
  { key: 'warranty', name: 'Warranty', type: 'single_line_text_field' },
  { key: 'origin', name: 'Origin', type: 'single_line_text_field' },
  { key: 'rx_compatible', name: 'Rx Compatible', type: 'boolean' },
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
            ownerType: 'PRODUCT',
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
