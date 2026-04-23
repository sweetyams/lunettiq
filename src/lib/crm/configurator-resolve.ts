/**
 * Resolve which configurator channels apply to a product.
 * Uses channel_product_rules evaluated against products_projection.
 * Results cached in Upstash Redis (1h TTL), invalidated on product webhook.
 */
import { db } from '@/lib/db';
import { channelProductRules, configuratorFlows, productsProjection } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getKey } from '@/lib/crm/integration-keys';

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = 'cfg:channel:';

// ── Redis helper (lazy, gated) ───────────────────────────

async function getRedis() {
  const url = await getKey('UPSTASH_REDIS_REST_URL');
  const token = await getKey('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;
  const { Redis } = await import('@upstash/redis');
  return new Redis({ url, token });
}

async function cacheGet(key: string): Promise<string | null> {
  try {
    const redis = await getRedis();
    if (!redis) return null;
    return await redis.get<string>(key);
  } catch { return null; }
}

async function cacheSet(key: string, value: string) {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.set(key, value, { ex: CACHE_TTL });
  } catch { /* silent */ }
}

export async function cacheInvalidate(productId: string) {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await redis.del(CACHE_PREFIX + productId);
  } catch { /* silent */ }
}

// ── Rule evaluation ──────────────────────────────────────

interface ProductData {
  tags: string[] | null;
  productType: string | null;
  shopifyProductId: string;
}

function ruleMatches(
  ruleType: string,
  value: string,
  product: ProductData,
): boolean {
  switch (ruleType) {
    case 'include_tag':
    case 'exclude_tag':
      return (product.tags ?? []).includes(value);
    case 'include_product_type':
    case 'exclude_product_type':
      return (product.productType ?? '').toLowerCase() === value.toLowerCase();
    case 'include_ids':
    case 'exclude_ids':
      return value.split(',').map(s => s.trim()).includes(product.shopifyProductId);
    default:
      return false;
  }
}

// ── Main resolver ────────────────────────────────────────

export interface ResolvedChannel {
  flowId: string;
  code: string;
  label: string;
  channelType: string;
}

export async function resolveChannelsForProduct(productId: string): Promise<ResolvedChannel[]> {
  // 1. Check cache
  const cached = await cacheGet(CACHE_PREFIX + productId);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fall through */ }
  }

  // 2. Load product
  const [product] = await db.select({
    shopifyProductId: productsProjection.shopifyProductId,
    tags: productsProjection.tags,
    productType: productsProjection.productType,
  }).from(productsProjection).where(eq(productsProjection.shopifyProductId, productId));

  if (!product) { await cacheSet(CACHE_PREFIX + productId, '[]'); return []; }

  // 3. Load all active rules + published flows
  const [rules, flows] = await Promise.all([
    db.select().from(channelProductRules).where(eq(channelProductRules.status, 'active')),
    db.select().from(configuratorFlows).where(eq(configuratorFlows.status, 'published')),
  ]);

  const flowMap = new Map(flows.map(f => [f.id, f]));

  // 4. Group rules by flowId, sort by priority
  const rulesByFlow = new Map<string, typeof rules>();
  for (const r of rules) {
    if (!rulesByFlow.has(r.flowId)) rulesByFlow.set(r.flowId, []);
    rulesByFlow.get(r.flowId)!.push(r);
  }
  for (const arr of rulesByFlow.values()) arr.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  // 5. Evaluate each channel
  const matched: ResolvedChannel[] = [];

  for (const [flowId, flowRules] of rulesByFlow) {
    const flow = flowMap.get(flowId);
    if (!flow) continue;

    let included = false;
    let excluded = false;

    for (const rule of flowRules) {
      if (!ruleMatches(rule.ruleType, rule.value, product)) continue;
      if (rule.ruleType.startsWith('exclude')) { excluded = true; break; }
      if (rule.ruleType.startsWith('include')) included = true;
    }

    if (included && !excluded) {
      matched.push({ flowId, code: flow.code, label: flow.label, channelType: flow.channelType });
    }
  }

  // 6. Cache + return
  await cacheSet(CACHE_PREFIX + productId, JSON.stringify(matched));
  return matched;
}
