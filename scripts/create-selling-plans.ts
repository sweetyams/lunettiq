#!/usr/bin/env tsx
/**
 * Create Shopify Selling Plan Group for Lunettiq Membership.
 * Attaches monthly + annual recurring plans to the membership product.
 *
 * Prerequisites:
 *   - App has `write_purchase_options` scope
 *   - Membership product exists (ID in membership-config.ts)
 *
 * Run: npx tsx scripts/create-selling-plans.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN!;
const GQL = `https://${SHOP}/admin/api/2024-01/graphql.json`;

async function gql(query: string, variables?: any) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) { console.error('GQL Error:', json.errors[0]?.message); return null; }
  return json.data;
}

async function main() {
  if (!SHOP || !TOKEN) { console.error('Missing env vars'); process.exit(1); }

  // Find the membership product
  const productData = await gql(`{
    products(first: 1, query: "product_type:Membership") {
      nodes { id title }
    }
  }`);

  const product = productData?.products?.nodes?.[0];
  if (!product) { console.error('Membership product not found'); process.exit(1); }
  console.log(`Found: ${product.title} (${product.id})`);

  // Create Selling Plan Group
  const result = await gql(`
    mutation sellingPlanGroupCreate($input: SellingPlanGroupInput!, $resources: SellingPlanGroupResourceInput!) {
      sellingPlanGroupCreate(input: $input, resources: $resources) {
        sellingPlanGroup {
          id
          name
          sellingPlans(first: 5) { nodes { id name } }
        }
        userErrors { field message }
      }
    }
  `, {
    input: {
      name: 'Lunettiq Membership',
      merchantCode: 'membership',
      options: ['Billing period'],
      sellingPlansToCreate: [
        {
          name: 'Monthly',
          options: ['Monthly'],
          billingPolicy: { recurring: { interval: 'MONTH', intervalCount: 1 } },
          deliveryPolicy: { recurring: { interval: 'MONTH', intervalCount: 1 } },
          pricingPolicies: [{ fixed: { adjustmentType: 'PRICE', adjustmentValue: { fixedValue: 0 } } }],
        },
        {
          name: 'Annual',
          options: ['Annual'],
          billingPolicy: { recurring: { interval: 'YEAR', intervalCount: 1 } },
          deliveryPolicy: { recurring: { interval: 'YEAR', intervalCount: 1 } },
          pricingPolicies: [{ fixed: { adjustmentType: 'PRICE', adjustmentValue: { fixedValue: 0 } } }],
        },
      ],
    },
    resources: {
      productIds: [product.id],
    },
  });

  const group = result?.sellingPlanGroupCreate;
  if (group?.userErrors?.length) {
    console.error('Errors:', group.userErrors.map((e: any) => e.message).join(', '));
    return;
  }

  if (group?.sellingPlanGroup) {
    console.log(`\n✓ Created Selling Plan Group: ${group.sellingPlanGroup.id}`);
    console.log('  Plans:');
    for (const plan of group.sellingPlanGroup.sellingPlans.nodes) {
      console.log(`    ${plan.name}: ${plan.id}`);
    }
    console.log('\nThe membership product now supports subscriptions.');
    console.log('Customers will see "Subscribe" option at checkout.');
  }
}

main();
