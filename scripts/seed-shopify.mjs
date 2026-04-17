/**
 * Create real customers + orders in Shopify from CSV export.
 * Run: node --env-file=.env.local scripts/seed-shopify.mjs
 */

import { readFileSync } from 'fs';

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
if (!SHOP || !TOKEN) { console.error('Missing env vars'); process.exit(1); }

const API = `https://${SHOP}/admin/api/2024-01`;
const headers = { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' };

async function shopifyPost(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) console.error(`  ❌ ${path}:`, JSON.stringify(data.errors || data).slice(0, 200));
  return { ok: res.ok, data };
}

// Parse CSV
const raw = readFileSync('/Users/yann/Development/Lunettiq/docs/Lunettiq Eyewear Orders Export.csv', 'utf-8');

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
  const hdrs = parseRow(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseRow(line);
    const obj = {};
    hdrs.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
    return obj;
  });
}

function parseRow(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { fields.push(current); current = ''; }
    else current += char;
  }
  fields.push(current);
  return fields;
}

const rows = parseCSV(raw);

// Group by order
const orderMap = new Map();
for (const row of rows) {
  const name = row['Name'];
  if (!orderMap.has(name)) orderMap.set(name, { header: row, lineItems: [] });
  if (row['Lineitem name']) {
    orderMap.get(name).lineItems.push(row);
  }
}

console.log(`\n📄 ${rows.length} rows → ${orderMap.size} orders\n`);

// Step 1: Create customers (dedupe by email)
const customerEmails = new Map();
for (const [, order] of orderMap) {
  const h = order.header;
  const email = h['Email'];
  if (!email || customerEmails.has(email)) continue;
  customerEmails.set(email, h);
}

console.log(`👤 Creating ${customerEmails.size} customers...\n`);
const emailToCustomerId = new Map();

for (const [email, h] of customerEmails) {
  const nameParts = (h['Billing Name'] || '').split(' ');
  const firstName = nameParts[0] || 'Unknown';
  const lastName = nameParts.slice(1).join(' ') || '';

  const { ok, data } = await shopifyPost('/customers.json', {
    customer: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone: h['Shipping Phone'] || h['Billing Phone'] || undefined,
      accepts_marketing: h['Accepts Marketing'] === 'yes',
      addresses: [{
        first_name: firstName,
        last_name: lastName,
        address1: h['Shipping Address1'] || undefined,
        address2: h['Shipping Address2'] || undefined,
        city: h['Shipping City'] || undefined,
        province: h['Shipping Province'] || undefined,
        zip: (h['Shipping Zip'] || '').replace(/^'/, ''),
        country: h['Shipping Country'] || undefined,
        phone: h['Shipping Phone'] || undefined,
      }],
      tags: 'imported',
    },
  });

  if (ok) {
    emailToCustomerId.set(email, data.customer.id);
    console.log(`  ✅ ${firstName} ${lastName} (${email})`);
  } else {
    // Customer might already exist — search for them
    const searchRes = await fetch(`${API}/customers/search.json?query=email:${email}`, { headers });
    const searchData = await searchRes.json();
    if (searchData.customers?.[0]) {
      emailToCustomerId.set(email, searchData.customers[0].id);
      console.log(`  ⏭  ${email} — already exists`);
    }
  }

  // Rate limit: ~2 requests per second to be safe
  await new Promise(r => setTimeout(r, 500));
}

// Step 2: Create orders
console.log(`\n📦 Creating ${orderMap.size} orders...\n`);
let created = 0;

for (const [orderName, order] of orderMap) {
  const h = order.header;
  const email = h['Email'];
  const customerId = emailToCustomerId.get(email);

  const lineItems = order.lineItems.map(li => ({
    title: li['Lineitem name'] || 'Item',
    quantity: parseInt(li['Lineitem quantity']) || 1,
    price: li['Lineitem price'] || '0',
    requires_shipping: li['Lineitem requires shipping'] === 'true',
    taxable: li['Lineitem taxable'] === 'true',
  }));

  if (!lineItems.length) continue;

  const nameParts = (h['Shipping Name'] || h['Billing Name'] || '').split(' ');

  const orderPayload = {
    order: {
      email: email || undefined,
      customer: customerId ? { id: customerId } : undefined,
      financial_status: h['Financial Status'] || 'paid',
      fulfillment_status: h['Fulfillment Status'] || null,
      currency: h['Currency'] || 'CAD',
      line_items: lineItems,
      total_tax: h['Taxes'] || '0',
      tags: 'imported',
      note: `Imported from CSV — original ${orderName}`,
      shipping_address: h['Shipping Address1'] ? {
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        address1: h['Shipping Address1'],
        address2: h['Shipping Address2'] || undefined,
        city: h['Shipping City'],
        province: h['Shipping Province'],
        zip: (h['Shipping Zip'] || '').replace(/^'/, ''),
        country: h['Shipping Country'],
        phone: h['Shipping Phone'] || undefined,
      } : undefined,
      billing_address: h['Billing Address1'] ? {
        first_name: (h['Billing Name'] || '').split(' ')[0],
        last_name: (h['Billing Name'] || '').split(' ').slice(1).join(' '),
        address1: h['Billing Address1'],
        address2: h['Billing Address2'] || undefined,
        city: h['Billing City'],
        province: h['Billing Province'],
        zip: (h['Billing Zip'] || '').replace(/^'/, ''),
        country: h['Billing Country'],
        phone: h['Billing Phone'] || undefined,
      } : undefined,
      processed_at: h['Created at'] || undefined,
      send_receipt: false,
      send_fulfillment_receipt: false,
      inventory_behaviour: 'bypass',
    },
  };

  const { ok, data } = await shopifyPost('/orders.json', orderPayload);
  if (ok) {
    console.log(`  ✅ ${orderName}`);
    created++;
  } else if (JSON.stringify(data).includes('rate limit')) {
    console.log(`  ⏳ ${orderName} — rate limited, waiting 60s...`);
    await new Promise(r => setTimeout(r, 60000));
    // Retry once
    const retry = await shopifyPost('/orders.json', orderPayload);
    if (retry.ok) { console.log(`  ✅ ${orderName} (retry)`); created++; }
  }

  await new Promise(r => setTimeout(r, 15000));
}

console.log(`\n✅ Done! Created ${created} orders, ${emailToCustomerId.size} customers\n`);
