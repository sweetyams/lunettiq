interface ProductData {
  id: string;
  tags: string[];
  priceMin: number;
  priceMax: number;
  metafields?: { custom?: { frame_width?: number } };
}

interface ScoreContext {
  faceShape?: string | null;
  stated: { shapes?: string[]; materials?: string[]; colours?: string[]; avoid?: string[] };
  derived: { shapes?: Record<string, number>; materials?: Record<string, number>; colours?: Record<string, number>; price_range?: { avg?: number } };
  purchasedIds: Set<string>;
  feedback: Map<string, string>; // productId → sentiment
  frameWidthMm?: number | null;
}

export function scoreProduct(product: ProductData, ctx: ScoreContext): { score: number; reasons: string[] } {
  if (ctx.purchasedIds.has(product.id)) return { score: -1000, reasons: ['already purchased'] };
  if (ctx.feedback.get(product.id) === 'dislike') return { score: -1000, reasons: ['previously disliked'] };

  // Avoid check
  for (const a of ctx.stated.avoid ?? []) {
    if (product.tags.some(t => t.includes(a))) return { score: -1000, reasons: [`avoids ${a}`] };
  }

  let score = 0;
  const reasons: string[] = [];

  const prev = ctx.feedback.get(product.id);
  if (prev === 'love') { score += 10; reasons.push('loved'); }
  else if (prev === 'like') { score += 5; reasons.push('liked'); }

  if (ctx.faceShape && product.tags.includes(`face-shape:${ctx.faceShape.toLowerCase()}`)) {
    score += 8; reasons.push(`suits ${ctx.faceShape} face`);
  }

  for (const s of ctx.stated.shapes ?? []) {
    if (product.tags.includes(`shape:${s}`)) { score += 6; reasons.push(`${s} shape`); break; }
  }
  for (const m of ctx.stated.materials ?? []) {
    if (product.tags.includes(`material:${m}`)) { score += 4; reasons.push(m); break; }
  }
  for (const c of ctx.stated.colours ?? []) {
    if (product.tags.includes(`colour:${c}`)) { score += 3; reasons.push(c); break; }
  }

  for (const [shape, weight] of Object.entries(ctx.derived.shapes ?? {})) {
    if (product.tags.includes(`shape:${shape}`)) { score += Math.min(weight, 3); break; }
  }
  for (const [mat, weight] of Object.entries(ctx.derived.materials ?? {})) {
    if (product.tags.includes(`material:${mat}`)) { score += Math.min(weight, 3); reasons.push(`derived: ${mat}`); break; }
  }
  for (const [col, weight] of Object.entries(ctx.derived.colours ?? {})) {
    if (product.tags.includes(`colour:${col}`)) { score += Math.min(weight, 3); break; }
  }

  const avg = ctx.derived.price_range?.avg;
  if (avg && product.priceMin <= avg * 1.3 && product.priceMax >= avg * 0.7) {
    score += 2; reasons.push('in price range');
  }

  const fw = ctx.frameWidthMm;
  const pfw = product.metafields?.custom?.frame_width;
  if (fw && pfw) {
    const diff = Math.abs(pfw - fw);
    if (diff <= 2) { score += 5; reasons.push('exact fit'); }
    else if (diff <= 4) score += 2;
    else if (diff > 8) score -= 4;
  }

  return { score, reasons };
}
