/**
 * Import orders from Shopify CSV export into CRM projection tables.
 * Also creates customer records from order data.
 * Run: node --env-file=.env.local scripts/import-orders-csv.mjs
 */

import { readFileSync } from 'fs';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

const { neon } = await import('@neondatabase/serverless');
const sql = neon(DB_URL);

const raw = readFileSync('/Users/yann/Development/Lunettiq/docs/Lunettiq Eyewear Orders Export.csv', 'utf-8');

// Parse CSV (handles quoted fields with commas)
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') { inQuotes = !inQuotes; current += char; }
    else if (char === '\n' && !inQuotes) { lines.push(current); current = ''; }
    else { current += char; }
  }
  if (current.trim()) lines.push(current);

  const headers = parseRow(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseRow(line);
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
    return obj;
  });
}

function parseRow(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { fields.push(current); current = ''; }
    else { current += char; }
  }
  fields.push(current);
  return fields;
}

const rows = parseCSV(raw);
console.log(`\n📄 Parsed ${rows.length} CSV rows\n`);

// Group line items by order name
const orderMap = new Map();
for (const row of rows) {
  const name = row['Name'];
  if (!orderMap.has(name)) orderMap.set(name, { header: row, lineItems: [] });
  orderMap.get(name).lineItems.push({
    name: row['Lineitem name'],
    quantity: parseInt(row['Lineitem quantity']) || 1,
    price: row['Lineitem price'],
    sku: row['Lineitem sku'],
    fulfillment_status: row['Lineitem fulfillment status'],
  });
}

console.log(`📦 ${orderMap.size} unique orders\n`);

// Track unique customers
const customerMap = new Map();

let orderCount = 0;
for (const [orderName, order] of orderMap) {
  const h = order.header;
  const shopifyOrderId = h['Id'];
  const email = h['Email'];

  if (!shopifyOrderId) continue;

  // Track customer by email
  if (email && !customerMap.has(email)) {
    customerMap.set(email, {
      email,
      firstName: (h['Billing Name'] || '').split(' ')[0],
      lastName: (h['Billing Name'] || '').split(' ').slice(1).join(' '),
      phone: h['Phone'] || h['Billing Phone'] || h['Shipping Phone'],
      acceptsMarketing: h['Accepts Marketing'] === 'yes',
      address: {
        address1: h['Shipping Address1'],
        address2: h['Shipping Address2'],
        city: h['Shipping City'],
        province: h['Shipping Province'],
        zip: h['Shipping Zip'],
        country: h['Shipping Country'],
        phone: h['Shipping Phone'],
      },
    });
  }

  // Upsert order
  await sql`
    INSERT INTO orders_projection (
      shopify_order_id, order_number, financial_status, fulfillment_status,
      total_price, subtotal_price, currency, line_items, shipping_address,
      tags, created_at, synced_at
    ) VALUES (
      ${shopifyOrderId}, ${orderName.replace('#', '')}, ${h['Financial Status'] || null},
      ${h['Fulfillment Status'] || null}, ${h['Total'] || '0'}, ${h['Subtotal'] || '0'},
      ${h['Currency'] || 'CAD'}, ${JSON.stringify(order.lineItems)},
      ${JSON.stringify({
        name: h['Shipping Name'],
        address1: h['Shipping Address1'],
        address2: h['Shipping Address2'],
        city: h['Shipping City'],
        zip: h['Shipping Zip'],
        province: h['Shipping Province'],
        country: h['Shipping Country'],
        phone: h['Shipping Phone'],
      })},
      ${h['Tags'] ? h['Tags'].split(', ').filter(Boolean) : []},
      ${h['Created at'] || null}, NOW()
    )
    ON CONFLICT (shopify_order_id) DO UPDATE SET
      financial_status = EXCLUDED.financial_status,
      fulfillment_status = EXCLUDED.fulfillment_status,
      total_price = EXCLUDED.total_price, line_items = EXCLUDED.line_items,
      shipping_address = EXCLUDED.shipping_address, synced_at = NOW()
  `;
  orderCount++;
}

// Upsert customers (using email as a temporary ID since we don't have Shopify customer IDs in the CSV)
let custCount = 0;
for (const [email, c] of customerMap) {
  const custId = `csv_${email.replace(/[^a-z0-9]/gi, '_')}`;
  await sql`
    INSERT INTO customers_projection (
      shopify_customer_id, email, phone, first_name, last_name,
      accepts_marketing, default_address, synced_at
    ) VALUES (
      ${custId}, ${email}, ${c.phone || null}, ${c.firstName}, ${c.lastName},
      ${c.acceptsMarketing}, ${JSON.stringify(c.address)}, NOW()
    )
    ON CONFLICT (shopify_customer_id) DO UPDATE SET
      phone = COALESCE(EXCLUDED.phone, customers_projection.phone),
      first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
      default_address = EXCLUDED.default_address, synced_at = NOW()
  `;

  // Link orders to this customer
  await sql`
    UPDATE orders_projection SET shopify_customer_id = ${custId}
    WHERE shopify_order_id IN (
      SELECT DISTINCT ${rows.filter(r => r['Email'] === email && r['Id']).map(r => r['Id'])[0] || ''}
    )
  `;
  custCount++;
}

// Simpler: link orders to customers by matching email in the CSV
for (const row of rows) {
  if (row['Id'] && row['Email']) {
    const custId = `csv_${row['Email'].replace(/[^a-z0-9]/gi, '_')}`;
    await sql`
      UPDATE orders_projection SET shopify_customer_id = ${custId}
      WHERE shopify_order_id = ${row['Id']} AND shopify_customer_id IS NULL
    `;
  }
}

console.log(`✅ Imported ${orderCount} orders`);
console.log(`✅ Created ${custCount} customers`);
console.log('\n✅ Done!\n');
