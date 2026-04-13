import { describe, it, expect } from 'vitest';
import { getExcludedCoatings } from './CoatingsStep';

describe('getExcludedCoatings', () => {
  it('returns empty map when no coatings selected', () => {
    expect(getExcludedCoatings([]).size).toBe(0);
  });

  it('excludes antiReflectivePremium when antiReflective is selected', () => {
    const excluded = getExcludedCoatings(['antiReflective']);
    expect(excluded.has('antiReflectivePremium')).toBe(true);
    expect(excluded.get('antiReflectivePremium')).toContain('Anti-Reflective');
  });

  it('excludes antiReflective when antiReflectivePremium is selected', () => {
    const excluded = getExcludedCoatings(['antiReflectivePremium']);
    expect(excluded.has('antiReflective')).toBe(true);
  });

  it('does not exclude unrelated coatings', () => {
    const excluded = getExcludedCoatings(['blueLight', 'scratchResistant']);
    expect(excluded.size).toBe(0);
  });
});
