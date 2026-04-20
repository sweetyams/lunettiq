#!/usr/bin/env tsx
/**
 * One-time script: Create journal article metafield definitions in Shopify.
 * Run with: npx tsx scripts/create-journal-metafields.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const API = `https://${SHOP}/admin/api/2024-01/graphql.json`;

const DEFINITIONS = [
  { key: 'pillar', name: 'Pillar', type: 'single_line_text_field' },
  { key: 'author_name', name: 'Author Name', type: 'single_line_text_field' },
  { key: 'author_bio', name: 'Author Bio', type: 'multi_line_text_field' },
  { key: 'author_image', name: 'Author Image', type: 'file_reference' },
  { key: 'read_time_minutes', name: 'Read Time (min)', type: 'number_integer' },
  { key: 'featured_products', name: 'Featured Products', type: 'list.product_reference' },
  { key: 'hero_image', name: 'Hero Image', type: 'file_reference' },
  { key: 'excerpt', name: 'Excerpt', type: 'multi_line_text_field' },
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
            namespace: 'journal',
            key: def.key,
            type: def.type,
            ownerType: 'ARTICLE',
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
