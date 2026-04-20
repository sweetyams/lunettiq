#!/usr/bin/env tsx
/**
 * Import products from live store. Run: npx tsx scripts/import-products.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const SHOP = process.env.IMPORT_SHOPIFY_SHOP!;
const TOKEN = process.env.IMPORT_SHOPIFY_ACCESS_TOKEN!;
const sql = neon(process.env.DATABASE_URL!);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchAll(path: string, key: string) {
  let all: any[] = [];
  let url = `https://${SHOP}/admin/api/2024-01${path}?limit=250`;
  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN } });
    if (res.status === 429) { console.log('  Rate limited...'); await sleep(2000); continue; }
    const data = await res.json();
    all = all.concat(data[key] ?? []);
    const link = res.headers.get('link') ?? '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : '';
    if (url) await sleep(500);
  }
  return all;
}

async function main() {
  await sql`DELETE FROM product_variants_projection`;
  await sql`DELETE FROM products_projection`;
  console.log('Cleared products. Fetching from Shopify...');

  const products = await fetchAll('/products.json', 'products');
  console.log(`Found ${products.length} products. Inserting...`);

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const images = (p.images ?? []).map((img: any) => ({ src: img.src, alt: img.alt }));
    const tags = p.tags ? p.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    const prices = (p.variants ?? []).map((v: any) => parseFloat(v.price || '0'));

    await sql`INSERT INTO products_projection (shopify_product_id, handle, title, description, product_type, vendor, tags, images, metafields, price_min, price_max, created_at, shopify_updated_at, synced_at)
      VALUES (${String(p.id)}, ${p.handle}, ${p.title}, ${p.body_html ?? ''}, ${p.product_type}, ${p.vendor}, ${tags}, ${JSON.stringify(images)}::jsonb, '{}'::jsonb, ${String(Math.min(...prices))}, ${String(Math.max(...prices))}, ${p.created_at}, ${p.updated_at}, now())
      ON CONFLICT (shopify_product_id) DO UPDATE SET handle=EXCLUDED.handle, title=EXCLUDED.title, tags=EXCLUDED.tags, images=EXCLUDED.images, price_min=EXCLUDED.price_min, price_max=EXCLUDED.price_max, synced_at=now()`;

    for (const v of p.variants ?? []) {
      const opts = [v.option1 && { name: p.options?.[0]?.name, value: v.option1 }, v.option2 && { name: p.options?.[1]?.name, value: v.option2 }].filter(Boolean);
      await sql`INSERT INTO product_variants_projection (shopify_variant_id, shopify_product_id, title, sku, price, compare_at_price, inventory_quantity, selected_options, available_for_sale, synced_at)
        VALUES (${String(v.id)}, ${String(p.id)}, ${v.title}, ${v.sku}, ${String(v.price)}, ${v.compare_at_price ? String(v.compare_at_price) : null}, ${v.inventory_quantity ?? 0}, ${JSON.stringify(opts)}::jsonb, ${v.inventory_quantity > 0}, now())
        ON CONFLICT (shopify_variant_id) DO UPDATE SET title=EXCLUDED.title, price=EXCLUDED.price, inventory_quantity=EXCLUDED.inventory_quantity, selected_options=EXCLUDED.selected_options, synced_at=now()`;
    }

    if ((i + 1) % 25 === 0 || i === products.length - 1) console.log(`  ${i + 1}/${products.length}`);
  }
  console.log('✓ Products done');
}
main().catch(console.error);
