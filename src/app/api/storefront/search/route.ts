export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productsProjection, collectionsProjection, searchSynonyms, searchQueries } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

// Query normalization
function normalize(q: string): string {
  return q.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\b(the|a|an|for|with|and|or)\b/g, '') // stopwords
    .replace(/frames?\b/g, 'frame')
    .replace(/glasses\b/g, 'glass')
    .replace(/sunglasses\b/g, 'sun')
    .replace(/\s+/g, ' ').trim();
}

// Known facets for suggestion detection
const FACETS: Record<string, string[]> = {
  shape: ['round', 'square', 'aviator', 'cat-eye', 'cateye', 'rectangular', 'oval', 'browline', 'geometric'],
  colour: ['black', 'tortoise', 'gold', 'silver', 'clear', 'blue', 'red', 'green', 'pink', 'white', 'crystal'],
  material: ['acetate', 'metal', 'titanium', 'wood', 'horn', 'mixed'],
  size: ['small', 'medium', 'large'],
};

function detectFacets(q: string): { text: string; type: string }[] {
  const suggestions: { text: string; type: string }[] = [];
  for (const [type, values] of Object.entries(FACETS)) {
    for (const v of values) {
      if (q.includes(v)) suggestions.push({ text: v, type });
    }
  }
  return suggestions;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const raw = params.get('q') ?? '';
  const limit = Math.min(Number(params.get('limit') ?? 8), 24);

  if (raw.length < 2) {
    return NextResponse.json({ products: [], collections: [], suggestions: [], meta: { total: 0, query: raw, personalized: false } });
  }

  const normalized = normalize(raw);

  // Expand synonyms
  let searchTerms = [normalized];
  let synonymFired: string | null = null;
  try {
    const syns = await db.select({ terms: searchSynonyms.terms }).from(searchSynonyms)
      .where(sql`${searchSynonyms.active} = true AND ${normalized} = ANY(${searchSynonyms.terms})`);
    if (syns.length > 0) {
      const allTerms = syns[0].terms.filter(t => t !== normalized);
      searchTerms = [normalized, ...allTerms];
      synonymFired = allTerms.join(', ');
    }
  } catch {}

  // Build search conditions for each term
  const termConditions = searchTerms.map(term => {
    const pattern = '%' + term + '%';
    return sql`(
      ${productsProjection.title} ILIKE ${pattern}
      OR ${productsProjection.vendor} ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM unnest(${productsProjection.tags}) t WHERE t ILIKE ${pattern})
    )`;
  });

  const where = searchTerms.length === 1
    ? sql`${termConditions[0]} AND (${productsProjection.status} = 'active' OR ${productsProjection.status} IS NULL)`
    : sql`(${sql.join(termConditions, sql` OR `)}) AND (${productsProjection.status} = 'active' OR ${productsProjection.status} IS NULL)`;

  // Query products
  const products = await db.select({
    id: productsProjection.shopifyProductId,
    handle: productsProjection.handle,
    title: productsProjection.title,
    vendor: productsProjection.vendor,
    priceMin: productsProjection.priceMin,
    tags: productsProjection.tags,
    images: productsProjection.images,
  }).from(productsProjection)
    .where(where)
    .orderBy(sql`(CASE WHEN ${productsProjection.title} ILIKE ${normalized + '%'} THEN 0 ELSE 1 END) ASC, ${productsProjection.title} ASC`)
    .limit(limit);

  // Format products
  const formattedProducts = products.map(p => {
    const imgs = (p.images ?? []) as Array<string | { src?: string }>;
    const imageUrl = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;
    return { id: p.id, handle: p.handle, title: p.title, vendor: p.vendor, price: p.priceMin, imageUrl, tags: p.tags };
  });

  // Query collections
  const collections = await db.select({
    handle: collectionsProjection.handle,
    title: collectionsProjection.title,
  }).from(collectionsProjection)
    .where(sql`${collectionsProjection.title} ILIKE ${'%' + normalized + '%'}`)
    .limit(3);

  // Facet suggestions
  const suggestions = detectFacets(normalized);

  // Count total (for "See all N products")
  const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(productsProjection).where(where);
  const total = Number(countRow?.count ?? 0);

  // Async query log (fire-and-forget)
  db.insert(searchQueries).values({
    queryRaw: raw,
    queryNormalized: normalized,
    resultCount: total,
    personalized: false,
    synonymFired,
    zeroResults: total === 0,
    deviceType: request.headers.get('sec-ch-ua-mobile') === '?1' ? 'mobile' : 'desktop',
  }).catch(() => {});

  return NextResponse.json({
    products: formattedProducts,
    collections,
    suggestions,
    meta: { total, query: raw, personalized: false },
  });
}
