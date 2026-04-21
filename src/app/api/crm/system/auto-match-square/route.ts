export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productMappings, productsProjection, productFamilies, productFamilyMembers } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql, eq } from 'drizzle-orm';

const COLOUR_ALIASES: Record<string, string[]> = {
  tortoise: ['tort', 'tortoise', 'cognac', 'écaille'],
  black: ['black', 'noir'],
  brown: ['brown', 'mocha', 'moka'],
  blue: ['blue', 'bleu', 'midnight'],
  green: ['green', 'vert', 'jade', 'olive', 'khaki'],
  grey: ['grey', 'gray', 'smoke', 'gunmetal'],
  clear: ['clear', 'crystal', 'transparent'],
  purple: ['purple', 'violet', 'plum'],
  red: ['red', 'rouge', 'burgundy', 'bordeau', 'crimson'],
  gold: ['gold', 'champagne', 'bronze'],
  pink: ['pink', 'rose'],
  orange: ['orange', 'amber'],
  white: ['white', 'marble'],
};

function normalizeColour(c: string): string {
  const lc = c.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(COLOUR_ALIASES)) {
    if (aliases.some(a => lc.includes(a))) return canonical;
  }
  return lc;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/©/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function parseSquareName(name: string): { frame: string; colour: string; type: 'optical' | 'sun' | 'service' | 'other' } {
  const lc = name.toLowerCase();
  if (lc.includes('appointment') || lc.includes('rendez') || lc.includes('exam') || lc.includes('service') || lc.includes('gift card') || lc.includes('carte cadeau') || lc.includes('cleaning') || lc.includes('repair') || lc.includes('adjustment')) {
    return { frame: name, colour: '', type: 'service' };
  }
  const dashSplit = name.split(/\s*-\s*/);
  let type: 'optical' | 'sun' | 'other' = 'other';
  if (dashSplit.length >= 2) {
    const suffix = dashSplit[dashSplit.length - 1].toLowerCase().trim();
    if (suffix.includes('prescription') || suffix.includes('optical') || suffix.includes('optic') || suffix === 'rx') type = 'optical';
    else if (suffix.includes('sun')) type = 'sun';
  }
  const frameColour = dashSplit[0].trim();
  const words = frameColour.split(/\s+/);
  // Handle multi-word frames: check if last word(s) are a colour
  let frame = words[0];
  let colour = words.slice(1).join(' ');
  // If frame is 2 words (e.g. "St Laurent"), check families
  if (words.length >= 3) {
    const twoWord = words.slice(0, 2).join(' ');
    colour = words.slice(2).join(' ');
    frame = twoWord;
  }
  return { frame, colour, type };
}

/**
 * POST /api/crm/system/auto-match-square
 * Re-runs auto-matching on unmatched items only. Skips manual/confirmed/related.
 */
export const POST = handler(async () => {
  const session = await requireCrmAuth('org:settings:integrations');

  // Load all data
  const [allMappings, allProducts, allFamilies, allMembers] = await Promise.all([
    db.select().from(productMappings),
    db.select({ id: productsProjection.shopifyProductId, title: productsProjection.title, handle: productsProjection.handle, category: sql`metafields->'custom'->>'product_category'` }).from(productsProjection),
    db.select().from(productFamilies),
    db.select().from(productFamilyMembers),
  ]);

  // Build lookup maps
  const familyByName = new Map(allFamilies.map(f => [normalize(f.name), f.id]));
  const membersByFamily = new Map<string, typeof allMembers>();
  for (const m of allMembers) {
    if (!membersByFamily.has(m.familyId)) membersByFamily.set(m.familyId, []);
    membersByFamily.get(m.familyId)!.push(m);
  }

  // Build product lookup by handle parts
  const productsByHandle = new Map(allProducts.map(p => [p.handle, p]));

  let updated = 0, skipped = 0, familyOnly = 0;
  const results: Array<{ square: string; match: string; score: number; status: string }> = [];

  for (const mapping of allMappings) {
    // Skip manually managed items
    if (['manual', 'confirmed', 'related'].includes(mapping.status ?? '')) { skipped++; continue; }
    if (mapping.status === 'ignored' && mapping.parsedType === 'service') { skipped++; continue; }

    const parsed = parseSquareName(mapping.squareName ?? '');
    if (parsed.type === 'service') {
      await db.update(productMappings).set({ parsedType: 'service', status: 'ignored', updatedAt: new Date() }).where(eq(productMappings.squareCatalogId, mapping.squareCatalogId));
      continue;
    }

    const normFrame = normalize(parsed.frame);
    const normColour = normalizeColour(parsed.colour);

    // 1. Try exact product match by family + colour + type
    const familyId = familyByName.get(normFrame) ?? familyByName.get(normFrame.replace(/\s/g, '-'));
    let bestProduct: string | null = null;
    let bestScore = 0;

    if (familyId) {
      const members = membersByFamily.get(familyId) ?? [];
      for (const m of members) {
        const memberColour = normalizeColour(m.colour ?? '');
        const memberType = m.type;
        let score = 0.5; // family match

        if (normColour && memberColour && normColour === memberColour) score += 0.3;
        else if (normColour && memberColour && (memberColour.includes(normColour) || normColour.includes(memberColour))) score += 0.2;

        if (parsed.type === 'optical' && memberType === 'optical') score += 0.2;
        else if (parsed.type === 'sun' && memberType === 'sun') score += 0.2;
        else if (parsed.type === 'other') score += 0.1;

        if (score > bestScore) { bestScore = score; bestProduct = m.productId; }
      }
    }

    // 2. Fallback: fuzzy match on product title/handle
    if (bestScore < 0.7) {
      for (const p of allProducts) {
        const pTitle = normalize(p.title ?? '');
        const pHandle = (p.handle ?? '').toLowerCase();
        if (!pTitle.includes(normFrame) && !pHandle.includes(normFrame.replace(/\s/g, '-'))) continue;

        let score = 0.4;
        const pCategory = (p.category as string) ?? '';
        if (parsed.type === 'optical' && pCategory === 'optical') score += 0.2;
        else if (parsed.type === 'sun' && pCategory === 'sun') score += 0.2;

        const handleColour = pHandle.split('-').pop() ?? '';
        if (normColour && normalizeColour(handleColour) === normColour) score += 0.3;
        else if (normColour && pTitle.includes(normColour)) score += 0.2;

        if (score > bestScore) { bestScore = score; bestProduct = p.id; }
      }
    }

    // Determine result
    const set: Record<string, any> = {
      parsedFrame: parsed.frame,
      parsedColour: parsed.colour,
      parsedType: parsed.type,
      confidence: String(Math.round(bestScore * 100) / 100),
      updatedAt: new Date(),
      matchedBy: session.userId,
    };

    if (bestScore >= 0.7 && bestProduct) {
      set.shopifyProductId = bestProduct;
      set.familyId = familyId ?? null;
      set.status = 'auto';
    } else if (familyId) {
      set.shopifyProductId = null;
      set.familyId = familyId;
      set.status = 'related';
      familyOnly++;
    } else {
      set.status = 'unmatched';
    }

    await db.update(productMappings).set(set).where(eq(productMappings.squareCatalogId, mapping.squareCatalogId));
    updated++;
    results.push({ square: mapping.squareName ?? '', match: bestProduct ?? familyId ?? 'none', score: bestScore, status: set.status });
  }

  const auto = results.filter(r => r.status === 'auto').length;
  const unmatched = results.filter(r => r.status === 'unmatched').length;

  return jsonOk({
    processed: updated,
    skipped,
    auto,
    familyOnly,
    unmatched,
    results: results.slice(0, 50), // preview
  });
});
