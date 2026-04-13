import { describe, it, expect } from 'vitest';

describe('Test setup', () => {
  it('vitest is configured correctly', () => {
    expect(true).toBe(true);
  });

  it('jsdom environment is available', () => {
    expect(typeof document).toBe('object');
  });
});
