export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { METAFIELD_GROUPS } from '@/lib/crm/metafield-schema';
import { db } from '@/lib/db';
import { storeSettings } from '@/lib/db/schema';

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
    userErrors { field message code }
  }
}`;

const UPDATE_DEFINITION = `mutation($definition: MetafieldDefinitionUpdateInput!) {
  metafieldDefinitionUpdate(definition: $definition) {
    updatedDefinition { id name key namespace }
    userErrors { field message code }
  }
}`;

/**
 * POST /api/crm/system/metafield-setup
 * Creates metafield definitions on Shopify for all canonical fields.
 */
export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  if (!SHOP || !TOKEN) return jsonError('Shopify not configured', 500);

  let created = 0, updated = 0, skipped = 0;
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
          ...(field.pin && { pin: true }),
        },
      });

      const userErrors = result.data?.metafieldDefinitionCreate?.userErrors ?? [];
      if (!userErrors.length) { created++; continue; }

      const isExisting = userErrors.some((e: any) => e.code === 'TAKEN' || e.message?.includes('in use') || e.message?.includes('already exists'));
      if (isExisting) {
        // Try updating the existing definition's name
        const upResult = await gql(UPDATE_DEFINITION, {
          definition: {
            namespace: 'custom',
            key: field.key,
            ownerType: 'PRODUCT',
            name: field.label,
          },
        });
        const upErrors = upResult.data?.metafieldDefinitionUpdate?.userErrors ?? [];
        if (upErrors.length) {
          skipped++;
        } else {
          updated++;
        }
      } else {
        errors.push(`${field.key}: ${userErrors.map((e: any) => e.message).join(', ')}`);
      }
    }
  }

  // Update CRM metafield visibility groups to match new schema
  const groups = METAFIELD_GROUPS.map(g => ({ label: g.label, keys: g.fields.map(f => `custom.${f.key}`) }));
  const allKeys = METAFIELD_GROUPS.flatMap(g => g.fields.map(f => `custom.${f.key}`));
  await db.insert(storeSettings).values({ key: 'metafield_groups', value: JSON.stringify(groups) })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: JSON.stringify(groups), updatedAt: new Date() } });
  await db.insert(storeSettings).values({ key: 'metafield_visible_fields', value: JSON.stringify(allKeys) })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: JSON.stringify(allKeys), updatedAt: new Date() } });

  return jsonOk({ created, updated, skipped, errors });
});
