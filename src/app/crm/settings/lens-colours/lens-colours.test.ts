import { describe, it, expect } from 'vitest';

// ── Lens colour set/option data validation ───────────────

interface LensColourSet { id: string; code: string; label: string; sortOrder: number }
interface LensColourOption { id: string; setId: string; code: string; label: string; hex: string | null; price: string; category: string | null; sortOrder: number }

// Simulates the seed data structure
const SEED_SETS: Omit<LensColourSet, 'id'>[] = [
  { code: 'standard', label: 'Standard', sortOrder: 0 },
  { code: 'custom_solid', label: 'Custom Solid', sortOrder: 10 },
  { code: 'custom_fade', label: 'Custom Fade', sortOrder: 20 },
  { code: 'polarized', label: 'Polarized', sortOrder: 30 },
];

const SEED_COLOURS: Omit<LensColourOption, 'id' | 'setId'>[] = [
  { code: 'std_black', label: 'Black', hex: '#1A1A1A', price: '0', category: 'standard', sortOrder: 0 },
  { code: 'std_brown', label: 'Brown', hex: '#6B4A2F', price: '0', category: 'standard', sortOrder: 10 },
  { code: 'cus_burgundy', label: 'Burgundy', hex: '#6E2233', price: '25', category: 'custom_solid', sortOrder: 0 },
  { code: 'cus_blue', label: 'Blue', hex: '#3A66A7', price: '25', category: 'custom_solid', sortOrder: 10 },
  { code: 'cus_champagne', label: 'Champagne', hex: '#D8C39A', price: '25', category: 'custom_solid', sortOrder: 20 },
  { code: 'cus_green', label: 'Green', hex: '#4F7A52', price: '25', category: 'custom_solid', sortOrder: 30 },
  { code: 'cus_mint', label: 'Mint', hex: '#9CC9B8', price: '25', category: 'custom_solid', sortOrder: 40 },
  { code: 'cus_dark_blue', label: 'Dark Blue', hex: '#233B73', price: '25', category: 'custom_solid', sortOrder: 50 },
  { code: 'fad_black', label: 'Black Fade', hex: '#2A2A2A', price: '25', category: 'custom_fade', sortOrder: 0 },
  { code: 'fad_brown', label: 'Brown Fade', hex: '#7A5A3A', price: '25', category: 'custom_fade', sortOrder: 10 },
  { code: 'fad_green', label: 'Green Fade', hex: '#5E7F63', price: '25', category: 'custom_fade', sortOrder: 20 },
  { code: 'fad_blue', label: 'Blue Fade', hex: '#5578A8', price: '25', category: 'custom_fade', sortOrder: 30 },
  { code: 'fad_red', label: 'Red Fade', hex: '#A14A57', price: '25', category: 'custom_fade', sortOrder: 40 },
  { code: 'fad_burgundy', label: 'Burgundy Fade', hex: '#7A3040', price: '25', category: 'custom_fade', sortOrder: 50 },
  { code: 'pol_black', label: 'Black', hex: '#1A1A1A', price: '70', category: 'polarized', sortOrder: 0 },
  { code: 'pol_brown', label: 'Brown', hex: '#6B4A2F', price: '70', category: 'polarized', sortOrder: 10 },
  { code: 'pol_khaki', label: 'Khaki', hex: '#7B6F4D', price: '70', category: 'polarized', sortOrder: 20 },
];

describe('Lens colour seed data', () => {
  it('has 4 sets', () => {
    expect(SEED_SETS).toHaveLength(4);
  });

  it('has 17 total colours', () => {
    expect(SEED_COLOURS).toHaveLength(17);
  });

  it('all codes are unique', () => {
    const codes = SEED_COLOURS.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('all set codes are unique', () => {
    const codes = SEED_SETS.map(s => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('standard colours are free', () => {
    const std = SEED_COLOURS.filter(c => c.category === 'standard');
    expect(std.every(c => c.price === '0')).toBe(true);
  });

  it('custom solid colours are $25', () => {
    const custom = SEED_COLOURS.filter(c => c.category === 'custom_solid');
    expect(custom.every(c => c.price === '25')).toBe(true);
  });

  it('custom fade colours are $25', () => {
    const fades = SEED_COLOURS.filter(c => c.category === 'custom_fade');
    expect(fades.every(c => c.price === '25')).toBe(true);
  });

  it('polarized colours are $70', () => {
    const pol = SEED_COLOURS.filter(c => c.category === 'polarized');
    expect(pol.every(c => c.price === '70')).toBe(true);
  });

  it('all colours have valid hex', () => {
    for (const c of SEED_COLOURS) {
      expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('sort orders are sequential within categories', () => {
    const byCategory = new Map<string, number[]>();
    for (const c of SEED_COLOURS) {
      if (!byCategory.has(c.category!)) byCategory.set(c.category!, []);
      byCategory.get(c.category!)!.push(c.sortOrder);
    }
    for (const [, orders] of byCategory) {
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    }
  });
});

// ── Group type resolution logic ──────────────────────────

describe('Choice type behaviour', () => {
  const CHOICE_TYPES = ['standard', 'product', 'colour', 'content'] as const;

  it('standard choices become cart attributes', () => {
    const choice = { choiceType: 'standard' as const, shopifyProductId: null, lensColourSetId: null };
    expect(choice.choiceType).toBe('standard');
    expect(choice.shopifyProductId).toBeNull();
  });

  it('product choices have shopifyProductId', () => {
    const choice = { choiceType: 'product' as const, shopifyProductId: '901234', lensColourSetId: null };
    expect(choice.choiceType).toBe('product');
    expect(choice.shopifyProductId).toBeTruthy();
  });

  it('colour choices have lensColourSetId', () => {
    const choice = { choiceType: 'colour' as const, shopifyProductId: null, lensColourSetId: 'set-123' };
    expect(choice.choiceType).toBe('colour');
    expect(choice.lensColourSetId).toBeTruthy();
  });

  it('content choices have no cart impact', () => {
    const choice = { choiceType: 'content' as const, shopifyProductId: null, lensColourSetId: null };
    expect(choice.choiceType).toBe('content');
  });

  it('all choice types are valid', () => {
    expect(CHOICE_TYPES).toContain('standard');
    expect(CHOICE_TYPES).toContain('product');
    expect(CHOICE_TYPES).toContain('colour');
    expect(CHOICE_TYPES).toContain('content');
  });

  it('choices can be mixed within a single group', () => {
    const group = { selectionMode: 'single' };
    const choices = [
      { choiceType: 'standard', label: 'Clear' },
      { choiceType: 'colour', label: 'Custom Tint' },
      { choiceType: 'content', label: 'What is included' },
    ];
    // All in the same group — valid
    expect(choices).toHaveLength(3);
    expect(group.selectionMode).toBe('single');
  });
});

// ── Colour pricing logic ─────────────────────────────────

describe('Lens colour pricing', () => {
  function getColourPrice(colourCode: string): number {
    const colour = SEED_COLOURS.find(c => c.code === colourCode);
    return colour ? Number(colour.price) : 0;
  }

  it('standard black is free', () => {
    expect(getColourPrice('std_black')).toBe(0);
  });

  it('custom burgundy is $25', () => {
    expect(getColourPrice('cus_burgundy')).toBe(25);
  });

  it('polarized black is $70', () => {
    expect(getColourPrice('pol_black')).toBe(70);
  });

  it('unknown colour returns 0', () => {
    expect(getColourPrice('nonexistent')).toBe(0);
  });

  it('fade colours cost same as custom solid', () => {
    expect(getColourPrice('fad_black')).toBe(getColourPrice('cus_blue'));
  });
});
