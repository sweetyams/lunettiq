/**
 * Backfill script — pulls existing Shopify data into projection tables.
 * Run: DOTENV_CONFIG_PATH=.env.local node --env-file=.env.local scripts/backfill.mjs
 */

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const DB_URL = process.env.DATABASE_URL;

if (!SHOP || !TOKEN || !DB_URL) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/backfill.mjs');
  process.exit(1);
}

const { neon } = await import('@neondatabase/serverless');
const sql = neon(DB_URL);

const API = `https://${SHOP}/admin/api/2024-01`;
const headers = { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' };

async function shopifyGet(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`Shopify ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Customers ───────────────────────────────────────────
async function backfillCustomers() {
  console.log('📥 Backfilling customers...');
  let url = '/customers.json?limit=250';
  let total = 0;

  while (url) {
    const data = await shopifyGet(url);
    for (const c of data.customers) {
      await sql`
        INSERT INTO customers_projection (
          shopify_customer_id, email, phone, first_name, last_name,
          total_spent, order_count, tags, default_address, addresses,
          metafields, accepts_marketing, sms_consent, created_at, shopify_updated_at, synced_at
        ) VALUES (
          ${String(c.id)}, ${c.email}, ${c.phone}, ${c.first_name}, ${c.last_name},
          ${c.total_spent || '0'}, ${c.orders_count || 0},
          ${c.tags ? c.tags.split(', ').filter(Boolean) : []},
          ${c.default_address ? JSON.stringify(c.default_address) : null},
          ${c.addresses ? JSON.stringify(c.addresses) : null},
          null, ${c.accepts_marketing || false}, false,
          ${c.created_at}, ${c.updated_at}, NOW()
        )
        ON CONFLICT (shopify_customer_id) DO UPDATE SET
          email = EXCLUDED.email, phone = EXCLUDED.phone,
          first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
          total_spent = EXCLUDED.total_spent, order_count = EXCLUDED.order_count,
          tags = EXCLUDED.tags, default_address = EXCLUDED.default_address,
          addresses = EXCLUDED.addresses, accepts_marketing = EXCLUDED.accepts_marketing,
          shopify_updated_at = EXCLUDED.shopify_updated_at, synced_at = NOW()
      `;
      total++;
    }
    // Pagination
    url = null; // Simple version — handles up to 250 customers
    // For stores with more, you'd parse the Link header
  }
  console.log(`  ✅ ${total} customers`);
}

// ─── Products ────────────────────────────────────────────
async function backfillProducts() {
  console.log('📥 Backfilling products...');
  const data = await shopifyGet('/products.json?limit=250');
  let total = 0;

  for (const p of data.products) {
    const prices = p.variants.map(v => parseFloat(v.price));
    const images = p.images.map(i => i.src);

    await sql`
      INSERT INTO products_projection (
        shopify_product_id, handle, title, description, product_type, vendor,
        tags, images, metafields, price_min, price_max,
        created_at, shopify_updated_at, synced_at
      ) VALUES (
        ${String(p.id)}, ${p.handle}, ${p.title}, ${p.body_html}, ${p.product_type}, ${p.vendor},
        ${p.tags ? p.tags.split(', ').filter(Boolean) : []},
        ${JSON.stringify(images)}, null,
        ${prices.length ? String(Math.min(...prices)) : null},
        ${prices.length ? String(Math.max(...prices)) : null},
        ${p.created_at}, ${p.updated_at}, NOW()
      )
      ON CONFLICT (shopify_product_id) DO UPDATE SET
        handle = EXCLUDED.handle, title = EXCLUDED.title, description = EXCLUDED.description,
        product_type = EXCLUDED.product_type, vendor = EXCLUDED.vendor, tags = EXCLUDED.tags,
        images = EXCLUDED.images, price_min = EXCLUDED.price_min, price_max = EXCLUDED.price_max,
        shopify_updated_at = EXCLUDED.shopify_updated_at, synced_at = NOW()
    `;

    for (const v of p.variants) {
      const img = v.image_id ? p.images.find(i => i.id === v.image_id)?.src : null;
      await sql`
        INSERT INTO product_variants_projection (
          shopify_variant_id, shopify_product_id, title, sku, price,
          compare_at_price, inventory_quantity, selected_options, image_url,
          available_for_sale, synced_at
        ) VALUES (
          ${String(v.id)}, ${String(p.id)}, ${v.title}, ${v.sku}, ${v.price},
          ${v.compare_at_price}, ${v.inventory_quantity || 0},
          ${JSON.stringify(v.option1 ? { option1: v.option1, option2: v.option2, option3: v.option3 } : null)},
          ${img}, ${(v.inventory_quantity || 0) > 0}, NOW()
        )
        ON CONFLICT (shopify_variant_id) DO UPDATE SET
          title = EXCLUDED.title, sku = EXCLUDED.sku, price = EXCLUDED.price,
          compare_at_price = EXCLUDED.compare_at_price, inventory_quantity = EXCLUDED.inventory_quantity,
          selected_options = EXCLUDED.selected_options, available_for_sale = EXCLUDED.available_for_sale,
          synced_at = NOW()
      `;
    }
    total++;
  }
  console.log(`  ✅ ${total} products`);
}

// ─── Orders ──────────────────────────────────────────────
async function backfillOrders() {
  console.log('📥 Backfilling orders...');
  const data = await shopifyGet('/orders.json?limit=250&status=any');
  let total = 0;

  for (const o of data.orders) {
    await sql`
      INSERT INTO orders_projection (
        shopify_order_id, shopify_customer_id, order_number, financial_status,
        fulfillment_status, total_price, subtotal_price, currency, line_items,
        shipping_address, tags, cancelled_at, processed_at, created_at, shopify_updated_at, synced_at
      ) VALUES (
        ${String(o.id)}, ${o.customer?.id ? String(o.customer.id) : null},
        ${String(o.order_number)}, ${o.financial_status}, ${o.fulfillment_status},
        ${o.total_price}, ${o.subtotal_price}, ${o.currency},
        ${JSON.stringify(o.line_items)}, ${o.shipping_address ? JSON.stringify(o.shipping_address) : null},
        ${o.tags ? o.tags.split(', ').filter(Boolean) : []},
        ${o.cancelled_at}, ${o.processed_at}, ${o.created_at}, ${o.updated_at}, NOW()
      )
      ON CONFLICT (shopify_order_id) DO UPDATE SET
        financial_status = EXCLUDED.financial_status, fulfillment_status = EXCLUDED.fulfillment_status,
        total_price = EXCLUDED.total_price, line_items = EXCLUDED.line_items,
        shopify_updated_at = EXCLUDED.shopify_updated_at, synced_at = NOW()
    `;
    total++;
  }
  console.log(`  ✅ ${total} orders`);
}

// ─── Collections ─────────────────────────────────────────
async function backfillCollections() {
  console.log('📥 Backfilling collections...');
  const [smart, custom] = await Promise.all([
    shopifyGet('/smart_collections.json?limit=250'),
    shopifyGet('/custom_collections.json?limit=250'),
  ]);
  const all = [...(smart.smart_collections || []), ...(custom.custom_collections || [])];

  for (const c of all) {
    await sql`
      INSERT INTO collections_projection (shopify_collection_id, handle, title, synced_at)
      VALUES (${String(c.id)}, ${c.handle}, ${c.title}, NOW())
      ON CONFLICT (shopify_collection_id) DO UPDATE SET
        handle = EXCLUDED.handle, title = EXCLUDED.title, synced_at = NOW()
    `;
  }
  console.log(`  ✅ ${all.length} collections`);
}

// ─── Run ─────────────────────────────────────────────────
console.log('\n🔄 Starting Shopify → Neon backfill...\n');
await backfillCustomers();
await backfillProducts();
await backfillOrders();
await backfillCollections();
console.log('\n✅ Backfill complete!\n');
