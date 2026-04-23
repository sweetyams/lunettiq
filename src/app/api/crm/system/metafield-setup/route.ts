export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { METAFIELD_GROUPS } from '@/lib/crm/metafield-schema';

const SHOP = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const GQL = `https://${SHOP}/admin/api/2024-10/graphql.json`;

async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN! },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const CREATE_DEFINITION = `mutation($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id name key namespace }
    userErrors { field message }
  }
}`;

/**
 * POST /api/crm/system/metafield-setup
 * Creates metafield definitions on Shopify for all canonical fields.
 */
export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  if (!SHOP || !TOKEN) return jsonError('Shopify not configured', 500);

  let created = 0, skipped = 0;
  const errors: string[] = [];

  for (const group of METAFIELD_GROUPS) {
    for (const field of group.fields) {
      const result = await gql(CREATE_DEFINITION, {
        definition: {
          name: field.label,
          namespace: 'custom',
          key: field.key,
          type: field.type ?? 'single_line_text_field',
          ownerType: 'PRODUCT',
          pin: true,
        },
      });

      const userErrors = result.data?.metafieldDefinitionCreate?.userErrors ?? [];
      if (userErrors.length) {
        const msg = userErrors.map((e: any) => e.message).join(', ');
        if (msg.includes('already exists') || msg.includes('taken')) {
          skipped++;
        } else {
          errors.push(`${field.key}: ${msg}`);
        }
      } else {
        created++;
      }
    }
  }

  return jsonOk({ created, skipped, errors });
});
