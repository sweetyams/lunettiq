export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';
import { OLD_KEY_MAP, ALL_FIELD_KEYS, FIELD_MAP, remapMetafields } from '@/lib/crm/metafield-schema';

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

const SET_METAFIELDS = `mutation($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key value }
    userErrors { field message }
  }
}`;

const canonicalKeys = new Set(ALL_FIELD_KEYS);

/**
 * POST /api/crm/system/metafield-import
 * Reads existing product metafields from local DB, remaps to new keys,
 * and writes them back to Shopify under the canonical keys.
 */
export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');
  if (!SHOP || !TOKEN) return jsonError('Shopify not configured', 500);

  // Get all products with metafields
  const products = await db.execute(sql`
    SELECT shopify_product_id as id, metafields->'custom' as custom
    FROM products_projection
    WHERE metafields->'custom' IS NOT NULL
    AND COALESCE(status, 'active') != 'archived'
  `);

  let updated = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of products.rows as Array<{ id: string; custom: Record<string, string> }>) {
    if (!row.custom || typeof row.custom !== 'object') { skipped++; continue; }

    const remapped = remapMetafields(row.custom);

    // Build metafield inputs — only canonical keys with values
    const metafields: Array<{ ownerId: string; namespace: string; key: string; value: string; type: string }> = [];
    for (const [key, value] of Object.entries(remapped)) {
      if (!canonicalKeys.has(key) || !value) continue;
      // Determine type from schema
      const field = FIELD_MAP.get(key);
      const type = field?.type ?? 'single_line_text_field';
      metafields.push({
        ownerId: `gid://shopify/Product/${row.id}`,
        namespace: 'custom',
        key,
        value: String(value),
        type,
      });
    }

    if (!metafields.length) { skipped++; continue; }

    // Batch write (Shopify allows up to 25 per call)
    for (let i = 0; i < metafields.length; i += 25) {
      const batch = metafields.slice(i, i + 25);
      const result = await gql(SET_METAFIELDS, { metafields: batch });
      const userErrors = result.data?.metafieldsSet?.userErrors ?? [];
      if (userErrors.length) {
        errors.push(`${row.id}: ${userErrors.map((e: any) => e.message).join(', ')}`);
      }
    }
    updated++;
  }

  return jsonOk({ updated, skipped, errors: errors.slice(0, 20), totalErrors: errors.length });
});
