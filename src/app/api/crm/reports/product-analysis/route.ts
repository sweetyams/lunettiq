export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection, productVariantsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth('org:reports:read');

  const products = await db.select({
    id: productsProjection.shopifyProductId,
    title: productsProjection.title,
    vendor: productsProjection.vendor,
    productType: productsProjection.productType,
    tags: productsProjection.tags,
    metafields: productsProjection.metafields,
    priceMin: productsProjection.priceMin,
    priceMax: productsProjection.priceMax,
  }).from(productsProjection);

  const variants = await db.select({
    productId: productVariantsProjection.shopifyProductId,
    inventoryQuantity: productVariantsProjection.inventoryQuantity,
    price: productVariantsProjection.price,
    selectedOptions: productVariantsProjection.selectedOptions,
  }).from(productVariantsProjection);

  // Build variant map
  const variantsByProduct = new Map<string, typeof variants>();
  for (const v of variants) {
    if (!variantsByProduct.has(v.productId!)) variantsByProduct.set(v.productId!, []);
    variantsByProduct.get(v.productId!)!.push(v);
  }

  // Parse dimensions from metafields
  type Dims = { frameWidth?: number; bridgeWidth?: number; lensWidth?: number; templeLength?: number; lensHeight?: number };
  const parsed: Array<{ title: string; type: string | null; vendor: string | null; material: string | null; dims: Dims; tags: string[]; price: number; inStock: boolean; colourCount: number }> = [];

  for (const p of products) {
    const mf = (p.metafields as any)?.custom ?? {};
    const dims: Dims = {};
    // Try parsed individual fields first, fall back to sizing_dimensions text
    if (mf.frame_width) dims.frameWidth = Number(mf.frame_width);
    if (mf.bridge_width) dims.bridgeWidth = Number(mf.bridge_width);
    if (mf.lens_width) dims.lensWidth = Number(mf.lens_width);
    if (mf.temple_length) dims.templeLength = Number(mf.temple_length);
    if (mf.lens_height) dims.lensHeight = Number(mf.lens_height);

    // Parse from sizing_dimensions if individual fields missing
    if (!dims.frameWidth && mf.sizing_dimensions) {
      for (const line of String(mf.sizing_dimensions).split('\n')) {
        const [label, val] = line.split(':').map((s: string) => s.trim());
        const num = Number(val?.replace(/[^0-9.]/g, ''));
        if (!num) continue;
        const l = label?.toLowerCase() ?? '';
        if (l.includes('frame width') && !dims.frameWidth) dims.frameWidth = num;
        else if ((l.includes('nose') || l.includes('bridge')) && !dims.bridgeWidth) dims.bridgeWidth = num;
        else if (l.includes('lens width') && !dims.lensWidth) dims.lensWidth = num;
        else if ((l.includes('length') || l.includes('temple')) && !dims.templeLength) dims.templeLength = num;
        else if (l.includes('height') && !dims.lensHeight) dims.lensHeight = num;
      }
    }

    const pvs = variantsByProduct.get(p.id) ?? [];
    const totalStock = pvs.reduce((sum, v) => sum + (v.inventoryQuantity ?? 0), 0);
    const colours = new Set(pvs.map(v => {
      const opts = v.selectedOptions as Array<{ name: string; value: string }> | null;
      return opts?.find(o => o.name.toLowerCase().includes('color') || o.name.toLowerCase().includes('colour'))?.value;
    }).filter(Boolean));

    parsed.push({
      title: p.title ?? '',
      type: p.productType,
      vendor: p.vendor,
      material: mf.material ?? null,
      dims,
      tags: p.tags ?? [],
      price: Number(p.priceMin ?? 0),
      inStock: totalStock > 0,
      colourCount: colours.size,
    });
  }

  // ─── Analysis ──────────────────────────────────────────

  const withDims = parsed.filter(p => p.dims.frameWidth);
  const frameWidths = withDims.map(p => p.dims.frameWidth!);
  const bridgeWidths = withDims.filter(p => p.dims.bridgeWidth).map(p => p.dims.bridgeWidth!);
  const lensWidths = withDims.filter(p => p.dims.lensWidth).map(p => p.dims.lensWidth!);
  const templeLengths = withDims.filter(p => p.dims.templeLength).map(p => p.dims.templeLength!);

  function stats(arr: number[]) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      min: sorted[0], max: sorted[sorted.length - 1],
      avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
      median: sorted[Math.floor(sorted.length / 2)],
      count: arr.length,
    };
  }

  function histogram(arr: number[], bucketSize: number) {
    const buckets: Record<string, number> = {};
    for (const v of arr) {
      const bucket = Math.floor(v / bucketSize) * bucketSize;
      const label = `${bucket}-${bucket + bucketSize - 1}`;
      buckets[label] = (buckets[label] ?? 0) + 1;
    }
    return Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0])).map(([range, count]) => ({ range, count }));
  }

  function countBy(arr: Array<string | null | undefined>) {
    const counts: Record<string, number> = {};
    for (const v of arr) { if (v) counts[v] = (counts[v] ?? 0) + 1; }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }

  // Size categories
  const sizeBreakdown = { small: 0, medium: 0, large: 0, unknown: 0 };
  for (const p of parsed) {
    const fw = p.dims.frameWidth;
    if (!fw) sizeBreakdown.unknown++;
    else if (fw < 130) sizeBreakdown.small++;
    else if (fw <= 140) sizeBreakdown.medium++;
    else sizeBreakdown.large++;
  }

  // Tag extraction
  const shapes = countBy(parsed.flatMap(p => p.tags.filter(t => t.startsWith('shape:')).map(t => t.replace('shape:', ''))));
  const colours = countBy(parsed.flatMap(p => p.tags.filter(t => t.startsWith('colour:')).map(t => t.replace('colour:', ''))));
  const materials = countBy(parsed.map(p => p.material));

  // Gaps analysis
  const gaps: string[] = [];
  if (sizeBreakdown.small < 5) gaps.push(`Only ${sizeBreakdown.small} small frames (< 130mm) — consider adding more for smaller faces`);
  if (sizeBreakdown.large < 5) gaps.push(`Only ${sizeBreakdown.large} large frames (> 140mm) — limited options for larger faces`);
  if (sizeBreakdown.unknown > parsed.length * 0.2) gaps.push(`${sizeBreakdown.unknown} products (${Math.round(sizeBreakdown.unknown / parsed.length * 100)}%) missing dimension data`);
  if (!shapes.length) gaps.push('No shape tags on products — limits filtering and personalization');
  if (!colours.length) gaps.push('No colour tags on products — limits filtering');
  const priceRange = parsed.map(p => p.price).filter(p => p > 0);
  if (priceRange.length) {
    const under200 = priceRange.filter(p => p < 200).length;
    const over500 = priceRange.filter(p => p > 500).length;
    if (under200 < 3) gaps.push('Very few entry-level options under $200');
    if (over500 < 3) gaps.push('Limited premium options over $500');
  }
  const outOfStock = parsed.filter(p => !p.inStock).length;
  if (outOfStock > parsed.length * 0.3) gaps.push(`${outOfStock} products (${Math.round(outOfStock / parsed.length * 100)}%) out of stock`);

  return jsonOk({
    summary: {
      totalProducts: parsed.length,
      withDimensions: withDims.length,
      missingDimensions: parsed.length - withDims.length,
      inStock: parsed.filter(p => p.inStock).length,
      outOfStock,
      avgColoursPerProduct: Math.round(parsed.reduce((s, p) => s + p.colourCount, 0) / parsed.length * 10) / 10,
    },
    dimensions: {
      frameWidth: { stats: stats(frameWidths), distribution: histogram(frameWidths, 5) },
      bridgeWidth: { stats: stats(bridgeWidths), distribution: histogram(bridgeWidths, 2) },
      lensWidth: { stats: stats(lensWidths), distribution: histogram(lensWidths, 5) },
      templeLength: { stats: stats(templeLengths), distribution: histogram(templeLengths, 5) },
    },
    sizeBreakdown,
    categories: {
      shapes,
      colours,
      materials,
      types: countBy(parsed.map(p => p.type)),
      vendors: countBy(parsed.map(p => p.vendor)),
    },
    priceDistribution: histogram(priceRange, 50),
    gaps,
  });
});
