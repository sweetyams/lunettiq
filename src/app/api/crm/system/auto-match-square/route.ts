export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection, productMappings } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';
import { getKey } from '@/lib/crm/integration-keys';

const COLOUR_ALIASES: Record<string, string[]> = {
  tortoise: ['tort', 'tortoise'], black: ['black'], brown: ['brown', 'mocha', 'moka'],
  blue: ['blue'], green: ['green'], grey: ['grey', 'gray'], clear: ['clear', 'crystal'],
  purple: ['purple'], red: ['red'], gold: ['gold', 'champagne'], pink: ['pink'],
};

function normalizeColour(c: string): string {
  const lower = c.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(COLOUR_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return canonical;
  }
  return lower;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/©/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export const POST = handler(async () => {
  await requireCrmAuth('org:settings:integrations');

  const squareToken = await getKey('SQUARE_ACCESS_TOKEN');
  if (!squareToken) return jsonError('Square not configured', 500);

  const base = process.env.SQUARE_ENVIRONMENT === 'sandbox' ? 'https://connect.squareupsandbox.com/v2' : 'https://connect.squareup.com/v2';

  // Fetch all Square items
  const items: Array<{ id: string; name: string }> = [];
  let cursor: string | undefined;
  do {
    const url = `${base}/catalog/list?types=ITEM${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${squareToken}` } });
    const data = await res.json();
    for (const obj of data.objects ?? []) items.push({ id: obj.id, name: obj.item_data?.name ?? '' });
    cursor = data.cursor;
  } while (cursor);

  // Load Shopify products
  const shopify = await db.select({ id: productsProjection.shopifyProductId, title: productsProjection.title, handle: productsProjection.handle, type: productsProjection.productType })
    .from(productsProjection).where(eq(productsProjection.status, 'active'));

  let autoMatched = 0, unmatched = 0, services = 0;

  for (const sq of items) {
    const name = sq.name;
    if (name.toLowerCase().includes('appointment') || name.toLowerCase().includes('rendez')) {
      await db.insert(productMappings).values({ squareCatalogId: sq.id, squareName: name, parsedType: 'service', status: 'ignored', confidence: '0', updatedAt: new Date() })
        .onConflictDoUpdate({ target: productMappings.squareCatalogId, set: { squareName: name, updatedAt: new Date() } });
      services++;
      continue;
    }

    const parts = name.split(' - ');
    const type = parts[1]?.toLowerCase().includes('sun') ? 'sun' : parts[1]?.toLowerCase().includes('prescription') ? 'optical' : 'other';
    const frameColour = parts[0]?.trim() ?? '';
    const words = frameColour.split(/\s+/);
    const frame = normalize(words[0] ?? '');
    const colour = normalizeColour(words.slice(1).join(' '));

    let bestMatch: typeof shopify[0] | null = null;
    let bestScore = 0;

    for (const sp of shopify) {
      const spTitle = normalize(sp.title ?? '');
      const spHandle = (sp.handle ?? '').toLowerCase();
      if (!spTitle.includes(frame) && !spHandle.includes(frame)) continue;
      let score = 0.4;
      const spIsOpt = sp.type?.toLowerCase().includes('optic') || spHandle.includes('-opt-');
      const spIsSun = sp.type?.toLowerCase().includes('sun') || spHandle.includes('-sun-');
      if (type === 'optical' && spIsOpt) score += 0.3;
      else if (type === 'sun' && spIsSun) score += 0.3;
      else score += 0.1;
      const spColour = normalizeColour(spTitle.replace(frame, '').trim());
      if (colour && spColour && colour === spColour) score += 0.3;
      else if (colour && spColour && (spColour.includes(colour) || colour.includes(spColour))) score += 0.2;
      if (score > bestScore) { bestScore = score; bestMatch = sp; }
    }

    const status = bestScore >= 0.7 ? 'auto' : 'unmatched';
    await db.insert(productMappings).values({
      squareCatalogId: sq.id, squareName: name, shopifyProductId: bestMatch?.id ?? null,
      parsedFrame: words[0], parsedColour: words.slice(1).join(' '), parsedType: type,
      confidence: String(bestScore), status, updatedAt: new Date(),
    }).onConflictDoUpdate({ target: productMappings.squareCatalogId, set: { squareName: name, shopifyProductId: bestMatch?.id ?? null, confidence: String(bestScore), status: status === 'auto' ? sql`CASE WHEN ${productMappings.status} IN ('confirmed', 'manual', 'related') THEN ${productMappings.status} ELSE 'auto' END` : productMappings.status, updatedAt: new Date() } });

    if (bestScore >= 0.7) autoMatched++;
    else unmatched++;
  }

  return jsonOk({ message: `Processed ${items.length} items. Auto: ${autoMatched}, Unmatched: ${unmatched}, Services: ${services}` });
});
