export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { customersProjection, productsProjection, ordersProjection, preferencesDerived, productFeedback, productInteractions } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and } from 'drizzle-orm';

export const GET = handler(async (request, ctx) => {
  await requireCrmAuth('org:products:read');
  const id = ctx.params.id;
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 10), 20);

  // Load client data
  const [client, derived, orders, disliked, recommended] = await Promise.all([
    db.select({ metafields: customersProjection.metafields, tags: customersProjection.tags })
      .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]),
    db.select().from(preferencesDerived).where(eq(preferencesDerived.shopifyCustomerId, id)).then(r => r[0]),
    db.select({ lineItems: ordersProjection.lineItems })
      .from(ordersProjection).where(eq(ordersProjection.shopifyCustomerId, id)),
    db.select({ productId: productFeedback.shopifyProductId }).from(productFeedback)
      .where(and(eq(productFeedback.shopifyCustomerId, id), eq(productFeedback.sentiment, 'dislike'))),
    db.select({ productId: productInteractions.shopifyProductId }).from(productInteractions)
      .where(and(eq(productInteractions.shopifyCustomerId, id), eq(productInteractions.interactionType, 'recommended'))),
  ]);

  const recommendedIds = new Set(recommended.map(r => r.productId));

  if (!client) return jsonError('Client not found', 404);

  // Extract client preferences
  const meta = ((client.metafields as Record<string, Record<string, string>> | null)?.custom) ?? {};
  const faceShape = (meta.face_shape ?? '').toLowerCase();
  let stated: { shapes?: string[]; materials?: string[]; colours?: string[] } = {};
  try { stated = meta.preferences_json ? JSON.parse(meta.preferences_json) : {}; } catch { /* empty */ }

  const derivedMats = ((derived?.derivedMaterials ?? []) as Array<{ name: string }>).map(m => m.name?.toLowerCase()).filter(Boolean);
  const derivedCols = ((derived?.derivedColours ?? []) as Array<{ name: string }>).map(c => c.name?.toLowerCase()).filter(Boolean);
  const derivedPrice = (derived?.derivedPriceRange ?? {}) as { min?: number; max?: number };

  // Build exclusion set + owned model names for variant boosting
  const excludedIds = new Set<string>();
  const excludedTitles = new Set<string>();
  const ownedModels = new Set<string>(); // e.g. "MARAIS", "BOWIE"
  for (const o of orders) {
    const items = (o.lineItems ?? []) as Array<{ name?: string; product_id?: number | string }>;
    for (const item of items) {
      if (item.product_id) excludedIds.add(String(item.product_id));
      if (item.name) {
        const fullName = item.name.split(' - ')[0].trim().toUpperCase();
        excludedTitles.add(fullName);
        const model = item.name.split('©')[0].trim().toUpperCase();
        if (model) ownedModels.add(model);
      }
    }
  }
  for (const d of disliked) excludedIds.add(d.productId);

  // Load all products
  const products = await db.select({
    shopifyProductId: productsProjection.shopifyProductId,
    title: productsProjection.title,
    vendor: productsProjection.vendor,
    priceMin: productsProjection.priceMin,
    tags: productsProjection.tags,
    images: productsProjection.images,
  }).from(productsProjection);

  // Score
  const scored = products.map(p => {
    if (excludedIds.has(p.shopifyProductId)) return null;
    // Also exclude by title match (since product_id may be missing from line items)
    if (p.title && excludedTitles.has(p.title.toUpperCase().trim())) return null;
    const ptags = (p.tags ?? []).map(t => t.toLowerCase());
    let score = 0;
    const reasons: string[] = [];

    // Staff-recommended products always show at top
    if (recommendedIds.has(p.shopifyProductId)) { score += 10; reasons.push('Staff pick'); }

    // Boost other colourways of owned models (e.g. owns MARAIS GREEN → suggest MARAIS BLUE)
    if (p.title) {
      const model = p.title.split('©')[0].trim().toUpperCase();
      if (model && ownedModels.has(model)) { score += 7; reasons.push(`New colourway`); }
    }

    if (faceShape && ptags.includes(faceShape)) { score += 3; reasons.push(`Matches face shape: ${faceShape}`); }
    for (const m of stated.materials ?? []) { if (ptags.includes(m.toLowerCase())) { score += 2; reasons.push(`Preferred material: ${m}`); break; } }
    for (const c of stated.colours ?? []) { if (ptags.includes(c.toLowerCase())) { score += 2; reasons.push(`Preferred colour: ${c}`); break; } }
    for (const m of derivedMats) { if (ptags.includes(m)) { score += 1; reasons.push('Matches purchase history'); break; } }
    for (const c of derivedCols) { if (ptags.includes(c)) { score += 1; break; } }
    if (derivedPrice.min && derivedPrice.max && p.priceMin) {
      const price = Number(p.priceMin);
      if (price >= derivedPrice.min && price <= derivedPrice.max) { score += 1; reasons.push('In price range'); }
    }

    if (score === 0) reasons.push('Browse');

    const imgs = (p.images ?? []) as Array<string | { src?: string }>;
    const img = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;

    return { product: { ...p, imageUrl: img }, matchReasons: reasons, score };
  }).filter(Boolean);

  scored.sort((a, b) => b!.score - a!.score);

  let results = scored.slice(0, limit);

  // Fallback: if not enough scored results, fill with newest non-purchased products
  if (results.length < limit) {
    const scoredIds = new Set(results.map(r => r!.product.shopifyProductId));
    const fallbacks = products
      .filter(p => !excludedIds.has(p.shopifyProductId) && !scoredIds.has(p.shopifyProductId) && !(p.title && excludedTitles.has(p.title.toUpperCase().trim())))
      .slice(0, limit - results.length)
      .map(p => {
        const imgs = (p.images ?? []) as Array<string | { src?: string }>;
        const img = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;
        return { product: { ...p, imageUrl: img }, matchReasons: ['New arrival'] as string[], score: 0 };
      });
    results = [...results, ...fallbacks];
  }

  return jsonOk(results);
});
