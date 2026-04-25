import { describe, it, expect } from 'vitest';

// ── Pure math tests (no DB) ──────────────────────────────

describe('recalcAvailable', () => {
  // Mirror the function from inventory.ts
  const recalcAvailable = (onHand: number, committed: number, securityStock: number) =>
    Math.max(0, onHand - committed - securityStock);

  it('basic calculation', () => {
    expect(recalcAvailable(12, 2, 2)).toBe(8);
  });

  it('floors at zero', () => {
    expect(recalcAvailable(2, 3, 1)).toBe(0);
  });

  it('zero stock', () => {
    expect(recalcAvailable(0, 0, 0)).toBe(0);
  });

  it('all committed', () => {
    expect(recalcAvailable(5, 5, 0)).toBe(0);
  });

  it('security stock eats all available', () => {
    expect(recalcAvailable(3, 0, 5)).toBe(0);
  });
});

describe('projectToChannels math — multi-location Shopify projection', () => {
  // Simulates the sum(max(0, available - buffer)) logic from projectToChannels
  function computeShopifyAvailable(
    locations: Array<{ available: number; buffer: number; fulfillsOnline: boolean }>
  ): number {
    return locations
      .filter(l => l.fulfillsOnline)
      .reduce((sum, l) => sum + Math.max(0, l.available - l.buffer), 0);
  }

  it('single warehouse, no buffer', () => {
    expect(computeShopifyAvailable([
      { available: 10, buffer: 0, fulfillsOnline: true },
    ])).toBe(10);
  });

  it('single warehouse with buffer', () => {
    expect(computeShopifyAvailable([
      { available: 10, buffer: 2, fulfillsOnline: true },
    ])).toBe(8);
  });

  it('buffer exceeds available — contributes zero, not negative', () => {
    expect(computeShopifyAvailable([
      { available: 1, buffer: 2, fulfillsOnline: true },
    ])).toBe(0);
  });

  it('multi-location sum', () => {
    expect(computeShopifyAvailable([
      { available: 10, buffer: 2, fulfillsOnline: true },  // contributes 8
      { available: 5, buffer: 2, fulfillsOnline: true },   // contributes 3
    ])).toBe(11);
  });

  it('non-fulfilling locations excluded', () => {
    expect(computeShopifyAvailable([
      { available: 10, buffer: 2, fulfillsOnline: true },  // contributes 8
      { available: 20, buffer: 0, fulfillsOnline: false },  // excluded
    ])).toBe(8);
  });

  it('all locations below buffer — zero', () => {
    expect(computeShopifyAvailable([
      { available: 1, buffer: 2, fulfillsOnline: true },
      { available: 0, buffer: 2, fulfillsOnline: true },
    ])).toBe(0);
  });

  it('mixed — some contribute, some dont', () => {
    expect(computeShopifyAvailable([
      { available: 8, buffer: 2, fulfillsOnline: true },   // 6
      { available: 1, buffer: 2, fulfillsOnline: true },   // 0
      { available: 5, buffer: 3, fulfillsOnline: true },   // 2
      { available: 100, buffer: 0, fulfillsOnline: false }, // excluded
    ])).toBe(8);
  });
});

describe('protections — available reduction', () => {
  function computeAvailableWithProtections(
    available: number,
    protections: Array<{ quantity: number; scope: string }>
  ): number {
    const allChannels = protections.filter(p => p.scope === 'all_channels').reduce((s, p) => s + p.quantity, 0);
    const onlineOnly = protections.filter(p => p.scope === 'online_only').reduce((s, p) => s + p.quantity, 0);
    return Math.max(0, available - allChannels - onlineOnly);
  }

  it('no protections', () => {
    expect(computeAvailableWithProtections(10, [])).toBe(10);
  });

  it('single hold', () => {
    expect(computeAvailableWithProtections(10, [
      { quantity: 1, scope: 'all_channels' },
    ])).toBe(9);
  });

  it('multiple protections stack', () => {
    expect(computeAvailableWithProtections(10, [
      { quantity: 1, scope: 'all_channels' },
      { quantity: 2, scope: 'online_only' },
    ])).toBe(7);
  });

  it('protections exceed available — floors at zero', () => {
    expect(computeAvailableWithProtections(2, [
      { quantity: 3, scope: 'all_channels' },
    ])).toBe(0);
  });

  it('square_only protections dont affect online', () => {
    expect(computeAvailableWithProtections(10, [
      { quantity: 5, scope: 'square_only' },
    ])).toBe(10);
  });
});

describe('last-unit lock trigger', () => {
  function shouldCreateLastUnitLock(
    totalAvailableAfterAdjust: number,
    familyHasProtection: boolean,
    existingLockExists: boolean
  ): boolean {
    return familyHasProtection && totalAvailableAfterAdjust <= 1 && totalAvailableAfterAdjust > 0 && !existingLockExists;
  }

  it('triggers at 1 unit', () => {
    expect(shouldCreateLastUnitLock(1, true, false)).toBe(true);
  });

  it('does not trigger at 2 units', () => {
    expect(shouldCreateLastUnitLock(2, true, false)).toBe(false);
  });

  it('does not trigger at 0 units', () => {
    expect(shouldCreateLastUnitLock(0, true, false)).toBe(false);
  });

  it('does not trigger if family protection disabled', () => {
    expect(shouldCreateLastUnitLock(1, false, false)).toBe(false);
  });

  it('does not duplicate if lock already exists', () => {
    expect(shouldCreateLastUnitLock(1, true, true)).toBe(false);
  });
});

describe('order routing — highest stock fulfilling location', () => {
  function routeOrder(
    locations: Array<{ id: string; available: number; fulfillsOnline: boolean }>,
    qty: number,
    defaultLocationId?: string
  ): string | null {
    const fulfilling = locations.filter(l => l.fulfillsOnline && l.available >= qty);
    if (!fulfilling.length) return null;
    let best = fulfilling[0];
    for (const l of fulfilling) {
      if (l.available > best.available) best = l;
    }
    // Tie-break: prefer default
    if (defaultLocationId) {
      const def = fulfilling.find(l => l.id === defaultLocationId && l.available === best.available);
      if (def) return def.id;
    }
    return best.id;
  }

  it('picks highest stock', () => {
    expect(routeOrder([
      { id: 'a', available: 5, fulfillsOnline: true },
      { id: 'b', available: 10, fulfillsOnline: true },
    ], 1)).toBe('b');
  });

  it('skips locations without enough stock', () => {
    expect(routeOrder([
      { id: 'a', available: 0, fulfillsOnline: true },
      { id: 'b', available: 3, fulfillsOnline: true },
    ], 2)).toBe('b');
  });

  it('skips non-fulfilling locations', () => {
    expect(routeOrder([
      { id: 'a', available: 100, fulfillsOnline: false },
      { id: 'b', available: 3, fulfillsOnline: true },
    ], 1)).toBe('b');
  });

  it('tie-break to default location', () => {
    expect(routeOrder([
      { id: 'a', available: 5, fulfillsOnline: true },
      { id: 'b', available: 5, fulfillsOnline: true },
    ], 1, 'b')).toBe('b');
  });

  it('returns null if no location has enough', () => {
    expect(routeOrder([
      { id: 'a', available: 1, fulfillsOnline: true },
    ], 5)).toBeNull();
  });
});
