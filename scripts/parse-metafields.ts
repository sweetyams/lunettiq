#!/usr/bin/env tsx
/**
 * Parse and sync product metafields from the live store format to the Lunettiq format.
 *
 * The live store uses:
 *   custom.sizing_dimensions  → "Frame width: 118\nNose Bridge: 22\nLens width: 53\nLength: 150\nHeight: 41"
 *   custom.composition        → Multi-line text with material, hinge, coating info
 *   theme.badge               → "New", "Best Seller", etc.
 *
 * This script parses those into the individual metafields the storefront expects:
 *   custom.frame_width        → 118 (number_integer)
 *   custom.bridge_width       → 22  (number_integer) — from "Nose Bridge"
 *   custom.lens_width         → 53  (number_integer) — from "Lens width"
 *   custom.temple_length      → 150 (number_integer) — from "Length"
 *   custom.lens_height        → 41  (number_integer) — from "Height"
 *   custom.material           → "Acetate" (single_line_text_field)
 *   custom.acetate_source     → "Mazzucchelli (Italy)"
 *   custom.hinge_type         → "OBE spring hinge, teflon-coated screws"
 *   custom.lens_coating       → "Anti-reflective + anti-scratch"
 *   custom.uv_protection      → "100% UVA/UVB"
 *   custom.included_accessories → "Hard case, microfibre cloth"
 *   custom.warranty           → "2 years"
 *
 * Usage:
 *   npx tsx scripts/parse-metafields.ts
 *
 * Prerequisites:
 *   - Products already imported into products_projection (via import-live-store.ts)
 *   - Metafield definitions created on target Shopify store (via create-product-metafields.ts)
 *   - SHOPIFY_ADMIN_API_ACCESS_TOKEN set for the target store
 *
 * When connecting to the real (live) store:
 *   1. Run create-product-metafields.ts to create the individual field definitions
 *   2. Run this script to parse existing data and write the new fields
 *   3. Update the live store's product pages to use the new fields
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const DB_URL = process.env.DATABASE_URL!;
const GQL = `https://${SHOP}/admin/api/2024-01/graphql.json`;

if (!SHOP || !TOKEN || !DB_URL) {
  console.error('Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_ACCESS_TOKEN, or DATABASE_URL');
  process.exit(1);
}

const sql = neon(DB_URL);

async function gql(query: string, variables?: any): Promise<any> {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) {
    console.log('  Rate limited, waiting 2s...');
    await new Promise(r => setTimeout(r, 2000));
    return gql(query, variables);
  }
  const json = await res.json();
  if (json.errors) console.error('  GQL error:', json.errors[0]?.message);
  return json.data;
}

// ─── Parsing logic ───────────────────────────────────────

function parseSizingDimensions(text: string): Record<string, string> {
  if (!text) return {};
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const [label, val] = line.split(':').map(s => s.trim());
    if (!val) continue;
    const num = val.replace(/[^0-9.]/g, '');
    if (!num) continue;
    const l = label.toLowerCase();
    if (l.includes('frame width')) result.frame_width = num;
    else if (l.includes('nose') || l.includes('bridge')) result.bridge_width = num;
    else if (l.includes('lens width')) result.lens_width = num;
    else if (l.includes('length') || l.includes('temple')) result.temple_length = num;
    else if (l.includes('height')) result.lens_height = num;
  }
  return result;
}

function parseComposition(text: string): Array<{ key: string; value: string; type: string }> {
  if (!text) return [];
  const fields: Array<{ key: string; value: string; type: string }> = [];
  const t = text.toLowerCase();

  if (t.includes('acetate')) fields.push({ key: 'material', value: 'Acetate', type: 'single_line_text_field' });
  else if (t.includes('titanium')) fields.push({ key: 'material', value: 'Titanium', type: 'single_line_text_field' });
  else if (t.includes('metal')) fields.push({ key: 'material', value: 'Metal', type: 'single_line_text_field' });

  if (t.includes('mazzucchelli')) fields.push({ key: 'acetate_source', value: 'Mazzucchelli (Italy)', type: 'single_line_text_field' });
  if (t.includes('obe')) fields.push({ key: 'hinge_type', value: 'OBE spring hinge, teflon-coated screws', type: 'single_line_text_field' });
  if (t.includes('anti-reflective')) fields.push({ key: 'lens_coating', value: 'Anti-reflective + anti-scratch', type: 'single_line_text_field' });
  if (t.includes('uva')) fields.push({ key: 'uv_protection', value: '100% UVA/UVB', type: 'single_line_text_field' });
  if (t.includes('case')) fields.push({ key: 'included_accessories', value: 'Hard case, microfibre cloth', type: 'single_line_text_field' });
  if (t.includes('warranty')) fields.push({ key: 'warranty', value: '2 years', type: 'single_line_text_field' });

  return fields;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log(`\nParsing metafields → ${SHOP}\n`);

  // Map product handles to Shopify GIDs
  const handleToGid = new Map<string, string>();
  let cursor: string | null = null;
  while (true) {
    const data = await gql(
      `query($c: String) { products(first: 100, after: $c) { pageInfo { hasNextPage endCursor } nodes { id handle } } }`,
      { c: cursor }
    );
    for (const p of data.products.nodes) handleToGid.set(p.handle, p.id);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  console.log(`Mapped ${handleToGid.size} products on Shopify\n`);

  // Load products from DB
  const dbProducts = await sql`SELECT handle, metafields FROM products_projection`;
  let synced = 0;
  let skipped = 0;

  for (const p of dbProducts) {
    const gid = handleToGid.get(p.handle);
    if (!gid) { skipped++; continue; }

    const mf = (p.metafields || {}) as Record<string, Record<string, string>>;
    const metafields: Array<{ namespace: string; key: string; value: string; type: string }> = [];

    // Parse sizing_dimensions → individual dimension fields
    const sizing = parseSizingDimensions(mf.custom?.sizing_dimensions);
    if (sizing.frame_width) metafields.push({ namespace: 'custom', key: 'frame_width', value: sizing.frame_width, type: 'number_integer' });
    if (sizing.bridge_width) metafields.push({ namespace: 'custom', key: 'bridge_width', value: sizing.bridge_width, type: 'number_integer' });
    if (sizing.lens_width) metafields.push({ namespace: 'custom', key: 'lens_width', value: sizing.lens_width, type: 'number_integer' });
    if (sizing.temple_length) metafields.push({ namespace: 'custom', key: 'temple_length', value: sizing.temple_length, type: 'number_integer' });
    if (sizing.lens_height) metafields.push({ namespace: 'custom', key: 'lens_height', value: sizing.lens_height, type: 'number_integer' });

    // Parse composition → material, hinge, coating, etc.
    for (const field of parseComposition(mf.custom?.composition)) {
      metafields.push({ namespace: 'custom', ...field });
    }

    if (!metafields.length) { skipped++; continue; }

    await gql(
      `mutation($input: ProductInput!) { productUpdate(input: $input) { userErrors { message } } }`,
      { input: { id: gid, metafields } }
    );

    synced++;
    if (synced % 25 === 0) console.log(`  ${synced} products synced...`);
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\n✓ Synced ${synced} products, skipped ${skipped}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
