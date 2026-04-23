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

  // Get all products with metafields (any namespace)
  const products = await db.execute(sql`
    SELECT shopify_product_id as id, metafields, title, tags
    FROM products_projection
    WHERE COALESCE(status, 'active') != 'archived'
  `);

  // Udesly key remap (same as single-product sync)
  const UDESLY_REMAP: Record<string, string> = { swatch: 'swatch', 'short-name': 'short_name', description: 'short_description', season: 'season', 'face-shape-recommendation': 'face_shapes', 'available-in-these-colors': 'sibling_colours', 'alter-ego': 'alter_ego', featured: 'featured', latest: 'latest', 'ben-s-favourites': 'staff_pick' };

  /**
   * Parse "ANDY © GREY - Prescription" → { name: "Andy", colour: "Grey" }
   * Also handles "SHELBY SUN MOKA", "FONTAINE OPTICS BLACK" etc.
   */
  function parseTitle(title: string): { name: string | null; colour: string | null } {
    if (!title) return { name: null, colour: null };
    // Strip trailing " - Prescription", " - Sunglasses" etc.
    const clean = title.replace(/\s*[-–]\s*(prescription|sunglasses|optical|optics)$/i, '').trim();
    // Split on © or – or - (with spaces)
    const parts = clean.split(/\s*[©–]\s*|\s+-\s+/).map(s => s.trim()).filter(Boolean);
    // Remove type words from parts
    const typeWords = new Set(['sun', 'optics', 'optical', 'sunglasses']);
    const filtered = parts.map(p => p.split(/\s+/).filter(w => !typeWords.has(w.toLowerCase())).join(' ')).filter(Boolean);
    const name = filtered[0] ? filtered[0].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : null;
    const colour = filtered[1] ? filtered[1].split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : null;
    return { name, colour };
  }

  function deriveType(tags: string[] | null): string | null {
    if (!tags) return null;
    const lower = tags.map(t => t.toLowerCase());
    if (lower.includes('sunglasses') || lower.includes('sun')) return 'Sunglasses';
    if (lower.includes('optics') || lower.includes('optical')) return 'Optical';
    return null;
  }

  let updated = 0, skipped = 0;
  const errors: string[] = [];

  for (const row of products.rows as Array<{ id: string; metafields: Record<string, Record<string, string>> | null; title: string; tags: string[] | null }>) {
    // Merge all namespaces into a flat object, udesly first then custom on top
    const merged: Record<string, string> = {};
    if (row.metafields && typeof row.metafields === 'object') {
      // Pull udesly keys through remap
      const udesly = row.metafields.udesly;
      if (udesly) {
        for (const [oldKey, newKey] of Object.entries(UDESLY_REMAP)) {
          if (udesly[oldKey]) merged[newKey] = udesly[oldKey];
        }
      }
      // Custom namespace overwrites
      const custom = row.metafields.custom;
      if (custom) Object.assign(merged, custom);
    }

    // Derive fields from title and tags
    const parsed = parseTitle(row.title);
    if (parsed.name && !merged.product_name && !merged.short_name) merged.product_name = parsed.name;
    if (parsed.colour && !merged.primary_frame_colour && !merged.frame_colour) merged.primary_frame_colour = parsed.colour;
    // Use udesly short_name as product_name if available
    if (merged.short_name && !merged.product_name) {
      merged.product_name = merged.short_name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    const derivedType = deriveType(row.tags);
    if (derivedType && !merged.product_type && !merged.product_category) merged.product_type = derivedType;

    if (!Object.keys(merged).length) { skipped++; continue; }

    const remapped = remapMetafields(merged);

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
