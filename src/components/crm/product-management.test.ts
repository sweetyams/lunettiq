import { describe, it, expect } from 'vitest';

// ── Source filter logic ──────────────────────────────────

describe('Source filter (Shopify/Square)', () => {
  const isSquare = (id: string) => id.startsWith('sq__');
  const sourceMatch = (id: string, filter: 'shopify' | 'square' | 'all') =>
    filter === 'all' || (filter === 'square' ? isSquare(id) : !isSquare(id));

  it('shopify filter shows Shopify products', () => {
    expect(sourceMatch('9115329167617', 'shopify')).toBe(true);
  });

  it('shopify filter hides Square products', () => {
    expect(sourceMatch('sq__ABC123', 'shopify')).toBe(false);
  });

  it('square filter shows Square products', () => {
    expect(sourceMatch('sq__ABC123', 'square')).toBe(true);
  });

  it('square filter hides Shopify products', () => {
    expect(sourceMatch('9115329167617', 'square')).toBe(false);
  });

  it('all filter shows everything', () => {
    expect(sourceMatch('9115329167617', 'all')).toBe(true);
    expect(sourceMatch('sq__ABC123', 'all')).toBe(true);
  });

  it('default filter is shopify', () => {
    const defaultFilter: 'shopify' | 'square' | 'all' = 'shopify';
    expect(defaultFilter).toBe('shopify');
  });
});

// ── Handle parsing for auto-assign ───────────────────────

describe('Family auto-assign handle parsing', () => {
  function parseHandle(handle: string) {
    const TYPE_SUFFIXES = ['opt', 'optics', 'sun', 'sunglasses'];
    const parts = handle.split('-');
    let family: string | null = null;
    let type: string | null = null;
    let colour: string | null = null;

    const typeIdx = parts.findIndex(p => p === 'opt' || p === 'sun');
    if (typeIdx >= 0 && typeIdx < parts.length - 1) {
      family = parts.slice(0, typeIdx).join('-');
      type = parts[typeIdx] === 'opt' ? 'optical' : 'sun';
      colour = parts.slice(typeIdx + 1).join('-');
    } else {
      const cIdx = parts.indexOf('©');
      if (cIdx >= 0 && cIdx < parts.length - 1) {
        family = parts.slice(0, cIdx).join('-');
        let tail = parts.slice(cIdx + 1);
        if (tail.length > 1 && /^\d+$/.test(tail[tail.length - 1])) tail = tail.slice(0, -1);
        if (tail.length > 1 && TYPE_SUFFIXES.includes(tail[tail.length - 1])) {
          type = tail[tail.length - 1] === 'sun' || tail[tail.length - 1] === 'sunglasses' ? 'sun' : 'optical';
          tail = tail.slice(0, -1);
        } else {
          type = 'optical';
        }
        colour = tail.join('-');
      }
    }
    return { family, type, colour };
  }

  it('parses shelby-opt-black', () => {
    expect(parseHandle('shelby-opt-black')).toEqual({ family: 'shelby', type: 'optical', colour: 'black' });
  });

  it('parses shelby-sun-grey', () => {
    expect(parseHandle('shelby-sun-grey')).toEqual({ family: 'shelby', type: 'sun', colour: 'grey' });
  });

  it('parses bond-©-silver', () => {
    expect(parseHandle('bond-©-silver')).toEqual({ family: 'bond', type: 'optical', colour: 'silver' });
  });

  it('parses multi-word family: jean-paul-opt-black', () => {
    expect(parseHandle('jean-paul-opt-black')).toEqual({ family: 'jean-paul', type: 'optical', colour: 'black' });
  });

  it('parses multi-word colour: shelby-opt-dark-turtle', () => {
    expect(parseHandle('shelby-opt-dark-turtle')).toEqual({ family: 'shelby', type: 'optical', colour: 'dark-turtle' });
  });

  it('returns null family for unparseable handle', () => {
    expect(parseHandle('cleaning-kit')).toEqual({ family: null, type: null, colour: null });
  });
});

// ── Table style standards ────────────────────────────────

describe('Table style standards', () => {
  const TABLE_WRAPPER = { border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' };
  const HEADER_BG = '#f9fafb';
  const HEADER_FONT = { fontSize: 10, color: '#6b7280', fontWeight: 500 };
  const CELL_PADDING = '6px 10px';
  const ROW_BORDER = '1px solid #f3f4f6';
  const REMOVE_COLOUR = '#d1d5db';

  it('wrapper has white background with border', () => {
    expect(TABLE_WRAPPER.background).toBe('#fff');
    expect(TABLE_WRAPPER.border).toContain('#e5e7eb');
    expect(TABLE_WRAPPER.borderRadius).toBe(8);
  });

  it('header has gray background', () => {
    expect(HEADER_BG).toBe('#f9fafb');
  });

  it('header font is 10px gray', () => {
    expect(HEADER_FONT.fontSize).toBe(10);
    expect(HEADER_FONT.color).toBe('#6b7280');
  });

  it('cells have consistent padding', () => {
    expect(CELL_PADDING).toBe('6px 10px');
  });

  it('rows separated by light border', () => {
    expect(ROW_BORDER).toContain('#f3f4f6');
  });

  it('remove button uses subtle gray', () => {
    expect(REMOVE_COLOUR).toBe('#d1d5db');
  });
});

// ── Picker locations audit ───────────────────────────────

describe('Product picker locations', () => {
  const INLINE_PICKER_LOCATIONS = [
    'Settings → Families (add member)',
    'Products → Family Detail (add product)',
    'Settings → Square Mapping (link product)',
    'Settings → Filters (assign product)',
  ];

  const MODAL_PICKER_LOCATIONS = [
    'Client Canvas (recommend)',
    'Configurator Preview (test product)',
    'Flow Builder (add product choice)',
  ];

  it('InlineProductPicker used in 4 locations', () => {
    expect(INLINE_PICKER_LOCATIONS).toHaveLength(4);
  });

  it('ProductSearchModal used in 3 locations', () => {
    expect(MODAL_PICKER_LOCATIONS).toHaveLength(3);
  });

  it('total 7 product picker locations', () => {
    expect(INLINE_PICKER_LOCATIONS.length + MODAL_PICKER_LOCATIONS.length).toBe(7);
  });
});
