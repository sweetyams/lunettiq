import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAnnouncementBars,
  getHomepageHeroes,
  getEditorialPanels,
  getCategoryPanels,
  getStoreLocations,
  getEyeTestCTAs,
  getLensOptions,
} from './metaobjects';

vi.mock('../storefront', () => ({
  storefrontFetch: vi.fn(),
}));

import { storefrontFetch } from '../storefront';

const mockStorefrontFetch = vi.mocked(storefrontFetch);

beforeEach(() => {
  mockStorefrontFetch.mockReset();
});

function makeNode(fields: Record<string, string | { image: { url: string } }>) {
  return {
    fields: Object.entries(fields).map(([key, val]) =>
      typeof val === 'string'
        ? { key, value: val, reference: undefined }
        : { key, value: null, reference: val }
    ),
  };
}

describe('getAnnouncementBars', () => {
  it('parses announcement bar metaobjects', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      metaobjects: {
        nodes: [
          makeNode({ message: 'Free shipping over $200', link_text: 'Shop now', link_url: '/collections/all', active: 'true' }),
        ],
      },
    });

    const bars = await getAnnouncementBars();
    expect(bars).toHaveLength(1);
    expect(bars[0].message).toBe('Free shipping over $200');
    expect(bars[0].linkText).toBe('Shop now');
    expect(bars[0].active).toBe(true);
  });
});

describe('getHomepageHeroes', () => {
  it('parses hero metaobjects with image references', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      metaobjects: {
        nodes: [
          makeNode({
            headline: 'New Collection',
            image_left: { image: { url: 'https://cdn.shopify.com/left.jpg' } },
            image_right: { image: { url: 'https://cdn.shopify.com/right.jpg' } },
            cta_text: 'Explore',
            cta_link: '/collections/new',
            active: 'true',
          }),
        ],
      },
    });

    const heroes = await getHomepageHeroes();
    expect(heroes).toHaveLength(1);
    expect(heroes[0].headline).toBe('New Collection');
    expect(heroes[0].imageLeft).toBe('https://cdn.shopify.com/left.jpg');
    expect(heroes[0].imageRight).toBe('https://cdn.shopify.com/right.jpg');
  });
});

describe('getEditorialPanels', () => {
  it('parses editorial panels with placement', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      metaobjects: {
        nodes: [
          makeNode({
            title: 'Summer Vibes',
            body: 'Explore our summer collection',
            image: { image: { url: 'https://cdn.shopify.com/editorial.jpg' } },
            link_url: '/collections/summer',
            placement: 'homepage',
          }),
        ],
      },
    });

    const panels = await getEditorialPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0].title).toBe('Summer Vibes');
    expect(panels[0].placement).toBe('homepage');
    expect(panels[0].image).toBe('https://cdn.shopify.com/editorial.jpg');
  });
});

describe('getCategoryPanels', () => {
  it('parses and sorts category panels by sortOrder', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      metaobjects: {
        nodes: [
          makeNode({
            title: 'Sun',
            image: { image: { url: 'https://cdn.shopify.com/sun.jpg' } },
            collection_handle: 'sun',
            sort_order: '2',
          }),
          makeNode({
            title: 'Optical',
            image: { image: { url: 'https://cdn.shopify.com/optical.jpg' } },
            collection_handle: 'optical',
            sort_order: '1',
          }),
        ],
      },
    });

    const panels = await getCategoryPanels();
    expect(panels).toHaveLength(2);
    expect(panels[0].title).toBe('Optical');
    expect(panels[1].title).toBe('Sun');
  });
});

describe('getStoreLocations', () => {
  it('parses store location with hours JSON', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      metaobjects: {
        nodes: [
          makeNode({
            name: 'Lunettiq Montréal',
            street_address: '123 Rue Sainte-Catherine',
            city: 'Montréal',
            province: 'QC',
            postal_code: 'H2X 1K3',
            phone: '514-555-0100',
            hours: '{"monday":"10-18","tuesday":"10-18"}',
            map_url: 'https://maps.google.com/test',
            active: 'true',
          }),
        ],
      },
    });

    const stores = await getStoreLocations();
    expect(stores).toHaveLength(1);
    expect(stores[0].name).toBe('Lunettiq Montréal');
    expect(stores[0].hours).toEqual({ monday: '10-18', tuesday: '10-18' });
    expect(stores[0].active).toBe(true);
  });
});

describe('getEyeTestCTAs', () => {
  it('parses eye test CTA metaobjects', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      metaobjects: {
        nodes: [
          makeNode({
            heading: 'Book an Eye Test',
            body: 'Visit our optometrist',
            cta_text: 'Book Now',
            cta_link: '/pages/eye-test',
            image: { image: { url: 'https://cdn.shopify.com/eye.jpg' } },
          }),
        ],
      },
    });

    const ctas = await getEyeTestCTAs();
    expect(ctas).toHaveLength(1);
    expect(ctas[0].heading).toBe('Book an Eye Test');
    expect(ctas[0].image).toBe('https://cdn.shopify.com/eye.jpg');
  });
});

describe('getLensOptions', () => {
  it('parses and sorts lens options by sortOrder', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      metaobjects: {
        nodes: [
          makeNode({
            type: 'coating',
            name: 'Blue Light',
            description: 'Filters blue light',
            price: '35.00',
            sort_order: '2',
            compatible_lens_types: '["singleVision","progressive"]',
            active: 'true',
          }),
          makeNode({
            type: 'lensIndex',
            name: 'Thin (1.61)',
            description: 'Thinner lenses',
            price: '45.00',
            sort_order: '1',
            compatible_lens_types: '["singleVision"]',
            active: 'true',
          }),
        ],
      },
    });

    const options = await getLensOptions();
    expect(options).toHaveLength(2);
    expect(options[0].name).toBe('Thin (1.61)');
    expect(options[0].type).toBe('lensIndex');
    expect(options[0].price).toBe(45);
    expect(options[1].name).toBe('Blue Light');
    expect(options[1].compatibleLensTypes).toEqual(['singleVision', 'progressive']);
  });
});
