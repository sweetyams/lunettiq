import { db } from '@/lib/db';
import { productsProjection, customersProjection, ordersProjection, preferencesDerived, productFeedback } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { scoreProduct } from '@/lib/crm/product-score';
import { eq, ilike } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth('org:products:read');
  const params = request.nextUrl.searchParams;
  const q = params.get('q');
  const customerId = params.get('customerId');
  const limit = Math.min(Number(params.get('limit') ?? 20), 50);

  const where = q ? ilike(productsProjection.title, `%${q}%`) : undefined;
  const products = await db.select().from(productsProjection).where(where).limit(limit);

  if (!customerId) {
    return jsonOk(products.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '')));
  }

  const [customer, derived, orders, feedback] = await Promise.all([
    db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]),
    db.select().from(preferencesDerived).where(eq(preferencesDerived.shopifyCustomerId, customerId)).then(r => r[0]),
    db.select({ lineItems: ordersProjection.lineItems }).from(ordersProjection).where(eq(ordersProjection.shopifyCustomerId, customerId)),
    db.select().from(productFeedback).where(eq(productFeedback.shopifyCustomerId, customerId)),
  ]);

  const meta = ((customer?.metafields as Record<string, Record<string, string>> | null)?.custom) ?? {};
  let stated: { shapes?: string[]; materials?: string[]; colours?: string[]; avoid?: string[] } = {};
  try { stated = meta.preferences_json ? JSON.parse(meta.preferences_json) : {}; } catch { /* empty */ }

  const purchasedIds = new Set<string>();
  for (const o of orders) {
    for (const item of (o.lineItems ?? []) as Array<{ product_id?: number | string }>) {
      if (item.product_id) purchasedIds.add(String(item.product_id));
    }
  }

  const feedbackMap = new Map(feedback.map(f => [f.shopifyProductId, f.sentiment ?? '']));

  const ctx = {
    faceShape: (meta.face_shape ?? null) as string | null,
    stated,
    derived: {
      shapes: (derived?.derivedShapes ?? {}) as Record<string, number>,
      materials: (derived?.derivedMaterials ?? {}) as Record<string, number>,
      colours: (derived?.derivedColours ?? {}) as Record<string, number>,
      price_range: (derived?.derivedPriceRange ?? {}) as { avg?: number },
    },
    purchasedIds,
    feedback: feedbackMap,
    frameWidthMm: (meta.frame_width_mm ? Number(meta.frame_width_mm) : null),
  };

  const scored = products
    .map(p => {
      const { score, reasons } = scoreProduct(
        { id: p.shopifyProductId, tags: (p.tags ?? []), priceMin: Number(p.priceMin ?? 0), priceMax: Number(p.priceMax ?? 0), metafields: p.metafields as ProductData['metafields'] },
        ctx,
      );
      return score > -1000 ? { ...p, matchScore: score, matchReasons: reasons } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b!.matchScore - a!.matchScore);

  return jsonOk(scored);
});

type ProductData = Parameters<typeof scoreProduct>[0];
