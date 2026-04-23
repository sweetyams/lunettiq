import { describe, it, expect } from 'vitest';

// ── ruleMatches (extracted logic) ────────────────────────

interface ProductData {
  tags: string[] | null;
  productType: string | null;
  shopifyProductId: string;
}

function ruleMatches(ruleType: string, value: string, product: ProductData): boolean {
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

// ── Resolution algorithm (extracted logic) ───────────────

interface Rule { ruleType: string; value: string; priority: number }
interface Flow { id: string; code: string; label: string; channelType: string }

function resolveChannels(
  product: ProductData,
  rulesByFlow: Map<string, Rule[]>,
  flowMap: Map<string, Flow>,
): Flow[] {
  const matched: Flow[] = [];
  for (const [flowId, flowRules] of rulesByFlow) {
    const flow = flowMap.get(flowId);
    if (!flow) continue;
    const sorted = [...flowRules].sort((a, b) => a.priority - b.priority);
    let included = false;
    let excluded = false;
    for (const rule of sorted) {
      if (!ruleMatches(rule.ruleType, rule.value, product)) continue;
      if (rule.ruleType.startsWith('exclude')) { excluded = true; break; }
      if (rule.ruleType.startsWith('include')) included = true;
    }
    if (included && !excluded) matched.push(flow);
  }
  return matched;
}

// ── Tests ────────────────────────────────────────────────

describe('ruleMatches', () => {
  const product: ProductData = {
    shopifyProductId: '123',
    tags: ['rx-compatible', 'new-arrival', 'acetate'],
    productType: 'Sunglasses',
  };

  it('matches include_tag when tag present', () => {
    expect(ruleMatches('include_tag', 'rx-compatible', product)).toBe(true);
  });

  it('does not match include_tag when tag absent', () => {
    expect(ruleMatches('include_tag', 'titanium', product)).toBe(false);
  });

  it('matches exclude_tag when tag present', () => {
    expect(ruleMatches('exclude_tag', 'new-arrival', product)).toBe(true);
  });

  it('matches include_product_type case-insensitively', () => {
    expect(ruleMatches('include_product_type', 'sunglasses', product)).toBe(true);
    expect(ruleMatches('include_product_type', 'SUNGLASSES', product)).toBe(true);
  });

  it('does not match wrong product type', () => {
    expect(ruleMatches('include_product_type', 'Optical', product)).toBe(false);
  });

  it('matches include_ids when ID in list', () => {
    expect(ruleMatches('include_ids', '100, 123, 456', product)).toBe(true);
  });

  it('does not match include_ids when ID absent', () => {
    expect(ruleMatches('include_ids', '100, 456', product)).toBe(false);
  });

  it('handles null tags gracefully', () => {
    expect(ruleMatches('include_tag', 'foo', { ...product, tags: null })).toBe(false);
  });

  it('handles null productType gracefully', () => {
    expect(ruleMatches('include_product_type', 'Sunglasses', { ...product, productType: null })).toBe(false);
  });

  it('returns false for unknown rule type', () => {
    expect(ruleMatches('unknown_type', 'foo', product)).toBe(false);
  });
});

describe('resolveChannels', () => {
  const optical: Flow = { id: 'f1', code: 'optical', label: 'Optical', channelType: 'optical' };
  const sun: Flow = { id: 'f2', code: 'sun', label: 'Sun', channelType: 'sun' };
  const flowMap = new Map([['f1', optical], ['f2', sun]]);

  it('matches product to channel via tag', () => {
    const product: ProductData = { shopifyProductId: '1', tags: ['rx-compatible'], productType: 'Eyeglasses' };
    const rulesByFlow = new Map([['f1', [{ ruleType: 'include_tag', value: 'rx-compatible', priority: 10 }]]]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([optical]);
  });

  it('matches product to channel via product type', () => {
    const product: ProductData = { shopifyProductId: '1', tags: [], productType: 'Sunglasses' };
    const rulesByFlow = new Map([['f2', [{ ruleType: 'include_product_type', value: 'Sunglasses', priority: 10 }]]]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([sun]);
  });

  it('exclude overrides include for same channel', () => {
    const product: ProductData = { shopifyProductId: '1', tags: ['rx-compatible', 'discontinued'], productType: null };
    const rulesByFlow = new Map([['f1', [
      { ruleType: 'include_tag', value: 'rx-compatible', priority: 10 },
      { ruleType: 'exclude_tag', value: 'discontinued', priority: 20 },
    ]]]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([]);
  });

  it('product can match multiple channels', () => {
    const product: ProductData = { shopifyProductId: '1', tags: ['rx-compatible'], productType: 'Sunglasses' };
    const rulesByFlow = new Map([
      ['f1', [{ ruleType: 'include_tag', value: 'rx-compatible', priority: 10 }]],
      ['f2', [{ ruleType: 'include_product_type', value: 'Sunglasses', priority: 10 }]],
    ]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([optical, sun]);
  });

  it('returns empty when no rules match', () => {
    const product: ProductData = { shopifyProductId: '1', tags: ['clearance'], productType: 'Accessories' };
    const rulesByFlow = new Map([['f1', [{ ruleType: 'include_tag', value: 'rx-compatible', priority: 10 }]]]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([]);
  });

  it('skips flows not in flowMap (unpublished)', () => {
    const product: ProductData = { shopifyProductId: '1', tags: ['rx-compatible'], productType: null };
    const rulesByFlow = new Map([['f-unknown', [{ ruleType: 'include_tag', value: 'rx-compatible', priority: 10 }]]]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([]);
  });

  it('respects priority order — exclude before include prevents match', () => {
    const product: ProductData = { shopifyProductId: '1', tags: ['rx-compatible', 'sample'], productType: null };
    const rulesByFlow = new Map([['f1', [
      { ruleType: 'exclude_tag', value: 'sample', priority: 5 },
      { ruleType: 'include_tag', value: 'rx-compatible', priority: 10 },
    ]]]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([]);
  });

  it('matches via include_ids', () => {
    const product: ProductData = { shopifyProductId: '999', tags: [], productType: null };
    const rulesByFlow = new Map([['f1', [{ ruleType: 'include_ids', value: '888, 999, 777', priority: 10 }]]]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([optical]);
  });

  it('exclude_ids removes from candidates', () => {
    const product: ProductData = { shopifyProductId: '999', tags: ['rx-compatible'], productType: null };
    const rulesByFlow = new Map([['f1', [
      { ruleType: 'include_tag', value: 'rx-compatible', priority: 10 },
      { ruleType: 'exclude_ids', value: '999', priority: 20 },
    ]]]);
    expect(resolveChannels(product, rulesByFlow, flowMap)).toEqual([]);
  });
});
