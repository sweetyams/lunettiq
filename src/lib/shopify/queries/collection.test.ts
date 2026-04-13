import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCollectionProducts } from './collection';

vi.mock('../storefront', () => ({
  storefrontFetch: vi.fn(),
}));

import { storefrontFetch } from '../storefront';

const mockStorefrontFetch = vi.mocked(storefrontFetch);

beforeEach(() => {
  mockStorefrontFetch.mockReset();
});

describe('getCollectionProducts', () => {
  it('returns null collection when handle not found', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({ collection: null });
    const result = await getCollectionProducts({ handle: 'nonexistent' });
    expect(result.collection).toBeNull();
    expect(result.products).toEqual([]);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  it('parses collection with products and pagination', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      collection: {
        id: 'gid://shopify/Collection/1',
        title: 'Optical',
        handle: 'optical',
        description: 'Optical frames',
        image: { url: 'https://cdn.shopify.com/col.jpg', altText: 'Optical', width: 1200, height: 600 },
        products: {
          pageInfo: { hasNextPage: true, endCursor: 'cursor123' },
          nodes: [
            {
              id: 'gid://shopify/Product/1',
              handle: 'frame-a',
              title: 'Frame A',
              priceRange: {
                minVariantPrice: { amount: '150.00', currencyCode: 'CAD' },
                maxVariantPrice: { amount: '150.00', currencyCode: 'CAD' },
              },
              images: { nodes: [{ url: 'https://cdn.shopify.com/a.jpg', altText: null, width: 800, height: 600 }] },
              options: [{ name: 'Color', values: ['Black'] }],
              tags: ['optical', 'acetate'],
            },
          ],
        },
      },
    });

    const result = await getCollectionProducts({ handle: 'optical', first: 12 });
    expect(result.collection).not.toBeNull();
    expect(result.collection!.title).toBe('Optical');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].handle).toBe('frame-a');
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.endCursor).toBe('cursor123');
  });

  it('passes sort and filter variables to storefrontFetch', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      collection: {
        id: 'gid://shopify/Collection/1',
        title: 'Sun',
        handle: 'sun',
        description: '',
        image: null,
        products: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [],
        },
      },
    });

    await getCollectionProducts({
      handle: 'sun',
      first: 24,
      sortKey: 'PRICE',
      reverse: true,
      filters: [{ available: true }],
    });

    expect(mockStorefrontFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        handle: 'sun',
        first: 24,
        sortKey: 'PRICE',
        reverse: true,
        filters: [{ available: true }],
      })
    );
  });
});
