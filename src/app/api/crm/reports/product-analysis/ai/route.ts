export const dynamic = "force-dynamic";
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { productsProjection, productVariantsProjection, ordersProjection, customersProjection, preferencesDerived, productFeedback } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { logAiRequest, checkDailyBudget } from '@/lib/crm/ai-usage';
import { sql } from 'drizzle-orm';

export const POST = handler(async (request) => {
  const session = await requireCrmAuth('org:reports:read');
  const { getKey } = await import('@/lib/crm/integration-keys');
    const apiKey = await getKey('ANTHROPIC_API_KEY');
  if (!apiKey) return jsonError('ANTHROPIC_API_KEY not configured', 500);
  if (!(await checkDailyBudget())) return jsonError('Daily AI budget reached', 429);

  const { focus } = await request.json(); // optional: "sizing", "pricing", "gaps", "trends"

  // ─── Gather all data ──────────────────────────────────

  const [products, variants, orders, customerPrefs, feedback, customerTags] = await Promise.all([
    db.select({
      id: productsProjection.shopifyProductId, title: productsProjection.title,
      vendor: productsProjection.vendor, type: productsProjection.productType,
      tags: productsProjection.tags, metafields: productsProjection.metafields,
      priceMin: productsProjection.priceMin, priceMax: productsProjection.priceMax,
    }).from(productsProjection),

    db.select({
      productId: productVariantsProjection.shopifyProductId,
      inventory: productVariantsProjection.inventoryQuantity,
      price: productVariantsProjection.price,
      options: productVariantsProjection.selectedOptions,
    }).from(productVariantsProjection),

    db.select({
      lineItems: ordersProjection.lineItems,
      total: ordersProjection.totalPrice,
      processedAt: ordersProjection.processedAt,
    }).from(ordersProjection),

    db.select({
      shapes: preferencesDerived.derivedShapes,
      materials: preferencesDerived.derivedMaterials,
      colours: preferencesDerived.derivedColours,
      priceRange: preferencesDerived.derivedPriceRange,
      orderCount: preferencesDerived.sourceOrderCount,
    }).from(preferencesDerived),

    db.select({
      productId: productFeedback.shopifyProductId,
      sentiment: productFeedback.sentiment,
      tryOnCount: productFeedback.tryOnCount,
      viewCount: productFeedback.viewCount,
    }).from(productFeedback),

    db.execute(sql`
      SELECT unnest(tags) as tag, count(*) as c
      FROM customers_projection
      WHERE tags IS NOT NULL
      GROUP BY tag ORDER BY c DESC LIMIT 30
    `),
  ]);

  // ─── Build summary for Claude ─────────────────────────

  // Product dimensions
  const dims = products.map(p => {
    const mf = (p.metafields as any)?.custom ?? {};
    const sizing = mf.sizing_dimensions ?? '';
    return { title: p.title, vendor: p.vendor, type: p.type, price: p.priceMin, tags: (p.tags ?? []).join(', '), sizing, material: mf.material ?? '' };
  });

  // Inventory summary
  const inventoryByProduct = new Map<string, number>();
  for (const v of variants) {
    inventoryByProduct.set(v.productId!, (inventoryByProduct.get(v.productId!) ?? 0) + (v.inventory ?? 0));
  }
  const outOfStock = products.filter(p => (inventoryByProduct.get(p.id) ?? 0) <= 0).length;
  const lowStock = products.filter(p => { const inv = inventoryByProduct.get(p.id) ?? 0; return inv > 0 && inv <= 3; }).length;

  // Sales data
  const productSales = new Map<string, number>();
  for (const o of orders) {
    for (const li of (o.lineItems ?? []) as Array<{ product_id?: number; quantity?: number }>) {
      if (li.product_id) productSales.set(String(li.product_id), (productSales.get(String(li.product_id)) ?? 0) + (li.quantity ?? 1));
    }
  }
  const topSellers = [...productSales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, qty]) => ({ title: products.find(p => p.id === id)?.title ?? id, qty }));
  const neverSold = products.filter(p => !productSales.has(p.id)).length;

  // Customer preference aggregation
  const prefSummary = { shapes: {} as Record<string, number>, materials: {} as Record<string, number>, colours: {} as Record<string, number> };
  for (const cp of customerPrefs) {
    for (const [k, v] of Object.entries((cp.shapes ?? {}) as Record<string, number>)) { prefSummary.shapes[k] = (prefSummary.shapes[k] ?? 0) + v; }
    for (const [k, v] of Object.entries((cp.materials ?? {}) as Record<string, number>)) { prefSummary.materials[k] = (prefSummary.materials[k] ?? 0) + v; }
    for (const [k, v] of Object.entries((cp.colours ?? {}) as Record<string, number>)) { prefSummary.colours[k] = (prefSummary.colours[k] ?? 0) + v; }
  }

  // Feedback summary
  const sentimentCounts = { love: 0, like: 0, neutral: 0, dislike: 0 };
  const mostTriedOn: Record<string, number> = {};
  for (const f of feedback) {
    if (f.sentiment) sentimentCounts[f.sentiment as keyof typeof sentimentCounts]++;
    if ((f.tryOnCount ?? 0) > 0) mostTriedOn[f.productId] = (mostTriedOn[f.productId] ?? 0) + (f.tryOnCount ?? 0);
  }

  const context = JSON.stringify({
    totalProducts: products.length,
    outOfStock,
    lowStock,
    neverSold,
    totalOrders: orders.length,
    topSellers,
    customerCount: customerPrefs.length,
    customerPreferences: prefSummary,
    customerTags: (customerTags.rows as any[]).slice(0, 15).map(r => ({ tag: r.tag, count: Number(r.c) })),
    sentimentCounts,
    productSample: dims.slice(0, 30),
    vendors: [...new Set(products.map(p => p.vendor).filter(Boolean))],
    types: [...new Set(products.map(p => p.type).filter(Boolean))],
    priceRange: { min: Math.min(...products.map(p => Number(p.priceMin ?? 0)).filter(n => n > 0)), max: Math.max(...products.map(p => Number(p.priceMax ?? 0))) },
  });

  // ─── Claude analysis ──────────────────────────────────

  const claude = new Anthropic({ apiKey });
  const focusPrompt = focus ? `Focus your analysis on: ${focus}.` : '';

  const message = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: `You are a product merchandising analyst for Lunettiq, a premium eyewear brand in Montreal. Analyze the catalogue data and provide actionable insights. Be specific with numbers. ${focusPrompt}

Return JSON:
{
  "summary": "2-3 sentence overview",
  "strengths": ["strength 1", "strength 2", ...],
  "gaps": ["gap 1 with specific numbers", "gap 2", ...],
  "recommendations": ["actionable rec 1", "actionable rec 2", ...],
  "sizing_insight": "1-2 sentences on size coverage",
  "pricing_insight": "1-2 sentences on pricing strategy",
  "demand_vs_supply": "where customer preferences don't match catalogue"
}`,
    messages: [{ role: 'user', content: context }],
  });

  await logAiRequest({ userId: session.userId, endpoint: 'product-analysis-ai', model: 'claude-haiku-4-5-20251001', usage: message.usage });

  const text = message.content.filter(c => c.type === 'text').map(c => c.text).join('');
  try {
    // Try to extract JSON from the response — handle code fences, extra text, etc.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonOk(JSON.parse(jsonMatch[0]));
    }
    return jsonOk({ summary: text, strengths: [], gaps: [], recommendations: [], sizing_insight: '', pricing_insight: '', demand_vs_supply: '' });
  } catch {
    return jsonOk({ summary: text, strengths: [], gaps: [], recommendations: [], sizing_insight: '', pricing_insight: '', demand_vs_supply: '' });
  }
});
