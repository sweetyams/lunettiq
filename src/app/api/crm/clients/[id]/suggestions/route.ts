import { db } from '@/lib/db';
import { customersProjection, productsProjection, ordersProjection, preferencesDerived } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const GET = handler(async (request, ctx) => {
  await requireCrmAuth('org:products:read');
  const id = ctx.params.id;
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 10), 20);

  // Load client data
  const [client, derived, orders] = await Promise.all([
    db.select({ metafields: customersProjection.metafields, tags: customersProjection.tags })
      .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]),
    db.select().from(preferencesDerived).where(eq(preferencesDerived.shopifyCustomerId, id)).then(r => r[0]),
    db.select({ lineItems: ordersProjection.lineItems })
      .from(ordersProjection).where(eq(ordersProjection.shopifyCustomerId, id)),
  ]);

  if (!client) return jsonError('Client not found', 404);

  // Extract client preferences
  const meta = ((client.metafields as Record<string, Record<string, string>> | null)?.custom) ?? {};
  const faceShape = (meta.face_shape ?? '').toLowerCase();
  let stated: { shapes?: string[]; materials?: string[]; colours?: string[] } = {};
  try { stated = meta.preferences_json ? JSON.parse(meta.preferences_json) : {}; } catch { /* empty */ }

  const derivedMats = ((derived?.derivedMaterials ?? []) as Array<{ name: string }>).map(m => m.name?.toLowerCase()).filter(Boolean);
  const derivedCols = ((derived?.derivedColours ?? []) as Array<{ name: string }>).map(c => c.name?.toLowerCase()).filter(Boolean);
  const derivedPrice = (derived?.derivedPriceRange ?? {}) as { min?: number; max?: number };

  // Purchased product IDs
  const purchasedIds = new Set<string>();
  for (const o of orders) {
    const items = (o.lineItems ?? []) as Array<{ product_id?: number | string }>;
    for (const item of items) {
      if (item.product_id) purchasedIds.add(String(item.product_id));
    }
  }

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
    if (purchasedIds.has(p.shopifyProductId)) return null;
    const ptags = (p.tags ?? []).map(t => t.toLowerCase());
    let score = 0;
    const reasons: string[] = [];

    if (faceShape && ptags.includes(faceShape)) { score += 3; reasons.push(`Matches face shape: ${faceShape}`); }
    for (const m of stated.materials ?? []) { if (ptags.includes(m.toLowerCase())) { score += 2; reasons.push(`Preferred material: ${m}`); break; } }
    for (const c of stated.colours ?? []) { if (ptags.includes(c.toLowerCase())) { score += 2; reasons.push(`Preferred colour: ${c}`); break; } }
    for (const m of derivedMats) { if (ptags.includes(m)) { score += 1; reasons.push('Matches purchase history'); break; } }
    for (const c of derivedCols) { if (ptags.includes(c)) { score += 1; break; } }
    if (derivedPrice.min && derivedPrice.max && p.priceMin) {
      const price = Number(p.priceMin);
      if (price >= derivedPrice.min && price <= derivedPrice.max) { score += 1; reasons.push('In price range'); }
    }

    if (score === 0) return null;

    const imgs = (p.images ?? []) as Array<string | { src?: string }>;
    const img = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;

    return { product: { ...p, imageUrl: img }, matchReasons: reasons, score };
  }).filter(Boolean);

  scored.sort((a, b) => b!.score - a!.score);

  return jsonOk(scored.slice(0, limit));
});
