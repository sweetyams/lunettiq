#!/usr/bin/env tsx
/**
 * Import all data from live store using GraphQL (fast, includes metafields).
 * Run: npx tsx scripts/import-live-store.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const SHOP = process.env.IMPORT_SHOPIFY_SHOP!;
const TOKEN = process.env.IMPORT_SHOPIFY_ACCESS_TOKEN!;
const sql = neon(process.env.DATABASE_URL!);
const GQL = `https://${SHOP}/admin/api/2024-01/graphql.json`;
const REST = (path: string) => `https://${SHOP}/admin/api/2024-01${path}`;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function gql(query: string, variables?: any): Promise<any> {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) { console.log('  Rate limited...'); await sleep(2000); return gql(query, variables); }
  const json = await res.json();
  if (json.errors) console.error('  GQL error:', json.errors[0]?.message);
  return json.data;
}

async function restFetchAll(path: string, key: string) {
  let all: any[] = [];
  let url = REST(`${path}?limit=250`);
  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN } });
    if (res.status === 429) { await sleep(2000); continue; }
    const data = await res.json();
    all = all.concat(data[key] ?? []);
    const link = res.headers.get('link') ?? '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : '';
    if (url) await sleep(500);
  }
  return all;
}

function stripGid(gid: string) { return gid.replace(/^gid:\/\/shopify\/\w+\//, ''); }

// ─── Products (GraphQL, 25 at a time with metafields) ────

const PRODUCTS_QUERY = `
query Products($cursor: String) {
  products(first: 25, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title descriptionHtml productType vendor tags
      createdAt updatedAt
      images(first: 10) { nodes { url altText } }
      variants(first: 50) {
        nodes { id title sku price inventoryQuantity
          compareAtPrice selectedOptions { name value }
          image { url } }
      }
      metafields(first: 30) { nodes { namespace key value type } }
      priceRangeV2 { minVariantPrice { amount } maxVariantPrice { amount } }
    }
  }
}`;

async function importProducts() {
  console.log('Importing products...');
  await sql`DELETE FROM product_variants_projection`;
  await sql`DELETE FROM products_projection`;

  let cursor: string | null = null;
  let total = 0;

  while (true) {
    const data = await gql(PRODUCTS_QUERY, { cursor });
    const { nodes, pageInfo } = data.products;

    for (const p of nodes) {
      const pid = stripGid(p.id);
      const metafields: any = {};
      for (const mf of p.metafields.nodes) {
        if (!metafields[mf.namespace]) metafields[mf.namespace] = {};
        metafields[mf.namespace][mf.key] = mf.value;
      }
      const images = p.images.nodes.map((i: any) => ({ src: i.url, alt: i.altText }));

      await sql`INSERT INTO products_projection (shopify_product_id, handle, title, description, product_type, vendor, tags, images, metafields, price_min, price_max, created_at, shopify_updated_at, synced_at)
        VALUES (${pid}, ${p.handle}, ${p.title}, ${p.descriptionHtml ?? ''}, ${p.productType}, ${p.vendor}, ${p.tags}, ${JSON.stringify(images)}::jsonb, ${JSON.stringify(metafields)}::jsonb, ${p.priceRangeV2.minVariantPrice.amount}, ${p.priceRangeV2.maxVariantPrice.amount}, ${p.createdAt}, ${p.updatedAt}, now())
        ON CONFLICT (shopify_product_id) DO UPDATE SET handle=EXCLUDED.handle, title=EXCLUDED.title, description=EXCLUDED.description, product_type=EXCLUDED.product_type, vendor=EXCLUDED.vendor, tags=EXCLUDED.tags, images=EXCLUDED.images, metafields=EXCLUDED.metafields, price_min=EXCLUDED.price_min, price_max=EXCLUDED.price_max, synced_at=now()`;

      for (const v of p.variants.nodes) {
        const vid = stripGid(v.id);
        await sql`INSERT INTO product_variants_projection (shopify_variant_id, shopify_product_id, title, sku, price, compare_at_price, inventory_quantity, selected_options, available_for_sale, synced_at)
          VALUES (${vid}, ${pid}, ${v.title}, ${v.sku}, ${v.price}, ${v.compareAtPrice}, ${v.inventoryQuantity ?? 0}, ${JSON.stringify(v.selectedOptions)}::jsonb, ${(v.inventoryQuantity ?? 0) > 0}, now())
          ON CONFLICT (shopify_variant_id) DO UPDATE SET title=EXCLUDED.title, price=EXCLUDED.price, inventory_quantity=EXCLUDED.inventory_quantity, selected_options=EXCLUDED.selected_options, available_for_sale=EXCLUDED.available_for_sale, synced_at=now()`;
      }
    }

    total += nodes.length;
    console.log(`  ${total} products`);
    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
    await sleep(500);
  }
  console.log(`✓ ${total} products with metafields + variants`);
}

// ─── Collections (REST, no per-item metafield needed) ────

async function importCollections() {
  console.log('Importing collections...');
  await sql`DELETE FROM collections_projection`;

  const customs = await restFetchAll('/custom_collections.json', 'custom_collections');
  const smarts = await restFetchAll('/smart_collections.json', 'smart_collections');
  const all = [...customs, ...smarts];
  console.log(`  Found ${all.length} collections`);

  for (const c of all) {
    let productIds: string[] = [];
    try {
      await sleep(500);
      const res = await fetch(REST(`/collections/${c.id}/products.json?limit=250&fields=id`), { headers: { 'X-Shopify-Access-Token': TOKEN } });
      if (res.ok) { const d = await res.json(); productIds = (d.products ?? []).map((p: any) => String(p.id)); }
    } catch {}

    await sql`INSERT INTO collections_projection (shopify_collection_id, handle, title, product_ids, synced_at)
      VALUES (${String(c.id)}, ${c.handle}, ${c.title}, ${productIds}, now())
      ON CONFLICT (shopify_collection_id) DO UPDATE SET handle=EXCLUDED.handle, title=EXCLUDED.title, product_ids=EXCLUDED.product_ids, synced_at=now()`;
  }
  console.log(`✓ ${all.length} collections`);
}

// ─── Customers (REST, bulk) ──────────────────────────────

async function importCustomers() {
  console.log('Importing customers...');
  await sql`DELETE FROM customers_projection`;

  const customers = await restFetchAll('/customers.json', 'customers');
  console.log(`  Found ${customers.length} customers. Inserting...`);

  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const tags = c.tags ? c.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

    await sql`INSERT INTO customers_projection (shopify_customer_id, email, phone, first_name, last_name, total_spent, order_count, tags, default_address, addresses, metafields, accepts_marketing, created_at, shopify_updated_at, synced_at)
      VALUES (${String(c.id)}, ${c.email}, ${c.phone}, ${c.first_name}, ${c.last_name}, ${c.total_spent ?? '0'}, ${c.orders_count ?? 0}, ${tags}, ${c.default_address ? JSON.stringify(c.default_address) : null}::jsonb, ${JSON.stringify(c.addresses ?? [])}::jsonb, '{}'::jsonb, ${c.accepts_marketing ?? false}, ${c.created_at}, ${c.updated_at}, now())
      ON CONFLICT (shopify_customer_id) DO UPDATE SET email=EXCLUDED.email, phone=EXCLUDED.phone, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, total_spent=EXCLUDED.total_spent, order_count=EXCLUDED.order_count, tags=EXCLUDED.tags, default_address=EXCLUDED.default_address, accepts_marketing=EXCLUDED.accepts_marketing, synced_at=now()`;

    if ((i + 1) % 50 === 0 || i === customers.length - 1) console.log(`  ${i + 1}/${customers.length} customers`);
  }
  console.log(`✓ ${customers.length} customers`);
}

// ─── Orders (REST, bulk) ─────────────────────────────────

async function importOrders() {
  console.log('Importing orders...');
  await sql`DELETE FROM orders_projection`;

  const orders = await restFetchAll('/orders.json?status=any', 'orders');
  console.log(`  Found ${orders.length} orders. Inserting...`);

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const lineItems = (o.line_items ?? []).map((li: any) => ({ name: li.name, product_id: li.product_id, variant_id: li.variant_id, quantity: li.quantity, price: li.price }));
    const tags = o.tags ? o.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];

    await sql`INSERT INTO orders_projection (shopify_order_id, shopify_customer_id, order_number, financial_status, fulfillment_status, total_price, subtotal_price, currency, line_items, shipping_address, tags, cancelled_at, processed_at, created_at, shopify_updated_at, synced_at)
      VALUES (${String(o.id)}, ${o.customer?.id ? String(o.customer.id) : null}, ${String(o.order_number)}, ${o.financial_status}, ${o.fulfillment_status}, ${o.total_price}, ${o.subtotal_price}, ${o.currency}, ${JSON.stringify(lineItems)}::jsonb, ${o.shipping_address ? JSON.stringify(o.shipping_address) : null}::jsonb, ${tags}, ${o.cancelled_at}, ${o.processed_at}, ${o.created_at}, ${o.updated_at}, now())
      ON CONFLICT (shopify_order_id) DO UPDATE SET financial_status=EXCLUDED.financial_status, fulfillment_status=EXCLUDED.fulfillment_status, total_price=EXCLUDED.total_price, line_items=EXCLUDED.line_items, synced_at=now()`;

    if ((i + 1) % 50 === 0 || i === orders.length - 1) console.log(`  ${i + 1}/${orders.length} orders`);
  }
  console.log(`✓ ${orders.length} orders`);

  // Detect membership purchases and activate
  const MEMBERSHIP_SKUS: Record<string, { tier: string; credit: number }> = {
    'MEMBERSHIP-ESSENTIAL-MONTHLY': { tier: 'essential', credit: 12 },
    'MEMBERSHIP-ESSENTIAL-ANNUAL': { tier: 'essential', credit: 144 },
    'MEMBERSHIP-CULT-MONTHLY': { tier: 'cult', credit: 25 },
    'MEMBERSHIP-CULT-ANNUAL': { tier: 'cult', credit: 300 },
    'MEMBERSHIP-VAULT-MONTHLY': { tier: 'vault', credit: 45 },
    'MEMBERSHIP-VAULT-ANNUAL': { tier: 'vault', credit: 540 },
  };
  const TIER_TAGS: Record<string, string> = { essential: 'member-essential', cult: 'member-cult', vault: 'member-vault' };

  let activated = 0;
  for (const o of orders) {
    const custId = o.customer?.id ? String(o.customer.id) : null;
    if (!custId) continue;
    for (const li of o.line_items ?? []) {
      const match = MEMBERSHIP_SKUS[li.sku];
      if (!match) continue;
      const tag = TIER_TAGS[match.tier];
      await sql`UPDATE customers_projection SET tags = array_append(array_remove(coalesce(tags, ARRAY[]::text[]), ${tag}), ${tag}) WHERE shopify_customer_id = ${custId}`;
      await sql`INSERT INTO credits_ledger (shopify_customer_id, currency, transaction_type, amount, running_balance, reason, related_order_id)
        VALUES (${custId}, 'credit', 'issued_membership', ${String(match.credit)}, ${String(match.credit)}, ${match.tier.toUpperCase() + ' membership activated'}, ${String(o.id)})
        ON CONFLICT DO NOTHING`;
      activated++;
    }
  }
  if (activated) console.log(`✓ Activated ${activated} memberships from orders`);
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log(`\nImporting from ${SHOP}\n`);
  await importProducts();
  await importCollections();
  await importCustomers();
  await importOrders();
  console.log('\n✓ All done.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
