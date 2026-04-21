#!/usr/bin/env tsx
/**
 * Auto-match Square catalog items to Shopify products.
 * Run: npx tsx scripts/auto-match-square.ts
 * 
 * Parses Square item names (e.g., "BPM Black - Prescription")
 * and matches to Shopify products by frame name + colour + type.
 */
import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/lib/db';
import { productsProjection, productMappings } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const SQUARE_TOKEN = process.env.SQUARE_ACCESS_TOKEN!;
const SQUARE_BASE = process.env.SQUARE_ENVIRONMENT === 'sandbox'
  ? 'https://connect.squareupsandbox.com/v2'
  : 'https://connect.squareup.com/v2';

// ─── Fetch all Square catalog items ──────────────────────

async function fetchAllSquareItems() {
  const items: Array<{ id: string; name: string }> = [];
  let cursor: string | undefined;

  do {
    const url = `${SQUARE_BASE}/catalog/list?types=ITEM${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${SQUARE_TOKEN}` } });
    const data = await res.json();
    for (const obj of data.objects ?? []) {
      items.push({ id: obj.id, name: obj.item_data?.name ?? '' });
    }
    cursor = data.cursor;
  } while (cursor);

  return items;
}

// ─── Parse Square item name ──────────────────────────────

function parseSquareName(name: string): { frame: string; colour: string; type: 'optical' | 'sun' | 'service' | 'other' } {
  // Services
  if (name.toLowerCase().includes('appointment') || name.toLowerCase().includes('rendez')) {
    return { frame: name, colour: '', type: 'service' };
  }

  // Pattern: "Frame Colour - Prescription/Sunglasses"
  const dashSplit = name.split(' - ');
  let type: 'optical' | 'sun' | 'other' = 'other';
  if (dashSplit.length >= 2) {
    const suffix = dashSplit[dashSplit.length - 1].toLowerCase().trim();
    if (suffix.includes('prescription') || suffix.includes('optical') || suffix.includes('optic')) type = 'optical';
    else if (suffix.includes('sun')) type = 'sun';
  }

  const frameColour = dashSplit[0].trim();
  // Split into frame (first word) and colour (rest)
  const words = frameColour.split(/\s+/);
  const frame = words[0] ?? '';
  const colour = words.slice(1).join(' ');

  return { frame, colour, type };
}

// ─── Normalize for matching ──────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/©/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Colour aliases for fuzzy matching
const COLOUR_ALIASES: Record<string, string[]> = {
  tortoise: ['tort', 'tortoise'],
  black: ['black', 'noir'],
  brown: ['brown', 'mocha', 'moka'],
  blue: ['blue', 'bleu'],
  green: ['green', 'vert'],
  grey: ['grey', 'gray'],
  clear: ['clear', 'crystal', 'transparent'],
  purple: ['purple', 'violet'],
  red: ['red', 'rouge'],
  gold: ['gold', 'champagne'],
  pink: ['pink', 'rose'],
};

function normalizeColour(colour: string): string {
  const c = colour.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(COLOUR_ALIASES)) {
    if (aliases.some(a => c.includes(a))) return canonical;
  }
  return c;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('Fetching Square catalog...');
  const squareItems = await fetchAllSquareItems();
  console.log(`Found ${squareItems.length} Square items`);

  console.log('Loading Shopify products...');
  const shopifyProducts = await db.select({
    id: productsProjection.shopifyProductId,
    title: productsProjection.title,
    handle: productsProjection.handle,
    type: productsProjection.productType,
  }).from(productsProjection).where(eq(productsProjection.status, 'active'));
  console.log(`Found ${shopifyProducts.length} Shopify products`);

  let autoMatched = 0;
  let suggested = 0;
  let unmatched = 0;
  let services = 0;

  for (const sq of squareItems) {
    const parsed = parseSquareName(sq.name);

    if (parsed.type === 'service') {
      await db.insert(productMappings).values({
        squareCatalogId: sq.id,
        squareName: sq.name,
        parsedFrame: parsed.frame,
        parsedColour: '',
        parsedType: 'service',
        status: 'ignored',
        confidence: '0',
        updatedAt: new Date(),
      }).onConflictDoUpdate({ target: productMappings.squareCatalogId, set: { squareName: sq.name, parsedType: 'service', status: 'ignored', updatedAt: new Date() } });
      services++;
      continue;
    }

    const normFrame = normalize(parsed.frame);
    const normColour = normalizeColour(parsed.colour);
    const isOptical = parsed.type === 'optical';

    // Find matching Shopify product
    let bestMatch: typeof shopifyProducts[0] | null = null;
    let bestScore = 0;

    for (const sp of shopifyProducts) {
      const spTitle = normalize(sp.title ?? '');
      const spHandle = (sp.handle ?? '').toLowerCase();

      // Frame name must match
      if (!spTitle.includes(normFrame) && !spHandle.includes(normFrame)) continue;

      let score = 0.4; // frame match base

      // Type match (opt/sun)
      const spIsOptical = sp.type?.toLowerCase().includes('optic') || spHandle.includes('-opt-');
      const spIsSun = sp.type?.toLowerCase().includes('sun') || spHandle.includes('-sun-');
      if (isOptical && spIsOptical) score += 0.3;
      else if (!isOptical && spIsSun) score += 0.3;
      else if (parsed.type === 'other') score += 0.1; // unknown type, partial credit

      // Colour match
      const spColour = normalizeColour(spTitle.replace(normFrame, '').trim());
      if (normColour && spColour && normColour === spColour) score += 0.3;
      else if (normColour && spColour && (spColour.includes(normColour) || normColour.includes(spColour))) score += 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = sp;
      }
    }

    const status = bestScore >= 0.8 ? 'auto' : bestScore >= 0.5 ? 'unmatched' : 'unmatched';
    const values = {
      squareCatalogId: sq.id,
      squareName: sq.name,
      shopifyProductId: bestMatch?.id ?? null,
      parsedFrame: parsed.frame,
      parsedColour: parsed.colour,
      parsedType: parsed.type,
      confidence: String(bestScore),
      status,
      updatedAt: new Date(),
    };

    await db.insert(productMappings).values(values).onConflictDoUpdate({
      target: productMappings.squareCatalogId,
      set: { ...values, squareCatalogId: undefined } as any,
    });

    if (bestScore >= 0.8) autoMatched++;
    else if (bestScore >= 0.5) suggested++;
    else unmatched++;
  }

  console.log(`\nResults:`);
  console.log(`  Auto-matched (≥80%): ${autoMatched}`);
  console.log(`  Suggested (50-79%):  ${suggested}`);
  console.log(`  Unmatched (<50%):    ${unmatched}`);
  console.log(`  Services (ignored):  ${services}`);
  console.log(`  Total:               ${squareItems.length}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
