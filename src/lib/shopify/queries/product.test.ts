import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProductByHandle, getProductRecommendations } from './product';

vi.mock('../storefront', () => ({
  storefrontFetch: vi.fn(),
}));

import { storefrontFetch } from '../storefront';

const mockStorefrontFetch = vi.mocked(storefrontFetch);

beforeEach(() => {
  mockStorefrontFetch.mockReset();
});

describe('getProductByHandle', () => {
  it('returns null when product is not found', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({ product: null });
    const result = await getProductByHandle('nonexistent');
    expect(result).toBeNull();
  });

  it('parses a full product response with metafields', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      product: {
        id: 'gid://shopify/Product/1',
        title: 'Classic Frame',
        handle: 'classic-frame',
        description: 'A classic frame',
        descriptionHtml: '<p>A classic frame</p>',
        priceRange: {
          minVariantPrice: { amount: '150.00', currencyCode: 'CAD' },
          maxVariantPrice: { amount: '200.00', currencyCode: 'CAD' },
        },
        options: [{ name: 'Color', values: ['Black', 'Tortoise'] }],
        variants: {
          nodes: [
            {
              id: 'gid://shopify/ProductVariant/1',
              title: 'Black / Clear',
              price: { amount: '150.00', currencyCode: 'CAD' },
              availableForSale: true,
              selectedOptions: [{ name: 'Color', value: 'Black' }],
              image: { url: 'https://cdn.shopify.com/img.jpg', altText: 'Black frame', width: 800, height: 600 },
            },
          ],
        },
        images: {
          nodes: [{ url: 'https://cdn.shopify.com/img.jpg', altText: 'Frame', width: 800, height: 600 }],
        },
        onFaceImages: { value: '["https://cdn.shopify.com/face1.jpg"]' },
        faceNotes: { value: 'Suits round faces' },
        material: { value: 'Acetate' },
        origin: { value: 'Italy' },
        rxCompatible: { value: 'true' },
        bridgeWidth: { value: '18' },
        lensWidth: { value: '52' },
        templeLength: { value: '145' },
        collections: {
          nodes: [{ id: 'gid://shopify/Collection/1', title: 'Optical', handle: 'optical', description: '' }],
        },
      },
    });

    const product = await getProductByHandle('classic-frame');
    expect(product).not.toBeNull();
    expect(product!.id).toBe('gid://shopify/Product/1');
    expect(product!.title).toBe('Classic Frame');
    expect(product!.variants).toHaveLength(1);
    expect(product!.images).toHaveLength(1);
    expect(product!.metafields.onFaceImages).toEqual(['https://cdn.shopify.com/face1.jpg']);
    expect(product!.metafields.material).toBe('Acetate');
    expect(product!.metafields.rxCompatible).toBe(true);
    expect(product!.metafields.bridgeWidth).toBe(18);
    expect(product!.metafields.lensWidth).toBe(52);
    expect(product!.metafields.templeLength).toBe(145);
    expect(product!.collections).toHaveLength(1);
  });

  it('handles missing metafields gracefully', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      product: {
        id: 'gid://shopify/Product/2',
        title: 'Simple Frame',
        handle: 'simple-frame',
        description: '',
        descriptionHtml: '',
        priceRange: {
          minVariantPrice: { amount: '100.00', currencyCode: 'CAD' },
          maxVariantPrice: { amount: '100.00', currencyCode: 'CAD' },
        },
        options: [],
        variants: { nodes: [] },
        images: { nodes: [] },
        onFaceImages: null,
        faceNotes: null,
        material: null,
        origin: null,
        rxCompatible: null,
        bridgeWidth: null,
        lensWidth: null,
        templeLength: null,
        collections: { nodes: [] },
      },
    });

    const product = await getProductByHandle('simple-frame');
    expect(product!.metafields.onFaceImages).toBeUndefined();
    expect(product!.metafields.material).toBeUndefined();
    expect(product!.metafields.rxCompatible).toBeUndefined();
    expect(product!.metafields.bridgeWidth).toBeUndefined();
  });
});

describe('getProductRecommendations', () => {
  it('returns mapped recommendation products', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      productRecommendations: [
        {
          id: 'gid://shopify/Product/10',
          title: 'Rec Frame',
          handle: 'rec-frame',
          priceRange: {
            minVariantPrice: { amount: '120.00', currencyCode: 'CAD' },
            maxVariantPrice: { amount: '120.00', currencyCode: 'CAD' },
          },
          images: { nodes: [{ url: 'https://cdn.shopify.com/rec.jpg', altText: null, width: 400, height: 300 }] },
          options: [{ name: 'Color', values: ['Black'] }],
        },
      ],
    });

    const recs = await getProductRecommendations('gid://shopify/Product/1');
    expect(recs).toHaveLength(1);
    expect(recs[0].handle).toBe('rec-frame');
    expect(recs[0].images).toHaveLength(1);
  });

  it('returns empty array when no recommendations', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({ productRecommendations: [] });
    const recs = await getProductRecommendations('gid://shopify/Product/1');
    expect(recs).toEqual([]);
  });
});
