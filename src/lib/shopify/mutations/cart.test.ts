import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cartCreate, cartLinesAdd, cartLinesUpdate, cartLinesRemove } from './cart';

vi.mock('../storefront', () => ({
  storefrontFetch: vi.fn(),
}));

import { storefrontFetch } from '../storefront';

const mockStorefrontFetch = vi.mocked(storefrontFetch);

beforeEach(() => {
  mockStorefrontFetch.mockReset();
});

const mockRawCart = {
  id: 'gid://shopify/Cart/1',
  checkoutUrl: 'https://test-store.myshopify.com/cart/c/1',
  lines: {
    nodes: [
      {
        id: 'gid://shopify/CartLine/1',
        quantity: 1,
        merchandise: {
          id: 'gid://shopify/ProductVariant/1',
          title: 'Black / Clear',
          price: { amount: '150.00', currencyCode: 'CAD' },
          availableForSale: true,
          selectedOptions: [{ name: 'Color', value: 'Black' }],
          image: { url: 'https://cdn.shopify.com/img.jpg', altText: null, width: 400, height: 300 },
        },
        attributes: [{ key: '_lensType', value: 'singleVision' }],
        cost: { totalAmount: { amount: '150.00', currencyCode: 'CAD' } },
      },
    ],
  },
  cost: {
    subtotalAmount: { amount: '150.00', currencyCode: 'CAD' },
    totalAmount: { amount: '150.00', currencyCode: 'CAD' },
  },
};

describe('cartCreate', () => {
  it('creates a cart and returns parsed ShopifyCart', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      cartCreate: { cart: mockRawCart, userErrors: [] },
    });

    const cart = await cartCreate();
    expect(cart.id).toBe('gid://shopify/Cart/1');
    expect(cart.checkoutUrl).toContain('myshopify.com');
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].attributes[0].key).toBe('_lensType');
  });

  it('throws on user errors', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      cartCreate: { cart: null, userErrors: [{ field: ['input'], message: 'Invalid input' }] },
    });

    await expect(cartCreate()).rejects.toThrow('Cart create failed: Invalid input');
  });
});

describe('cartLinesAdd', () => {
  it('adds lines and returns updated cart', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      cartLinesAdd: { cart: mockRawCart, userErrors: [] },
    });

    const cart = await cartLinesAdd('gid://shopify/Cart/1', [
      { merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1, attributes: [{ key: '_lensType', value: 'singleVision' }] },
    ]);

    expect(cart.id).toBe('gid://shopify/Cart/1');
    expect(mockStorefrontFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cartId: 'gid://shopify/Cart/1',
        lines: [{ merchandiseId: 'gid://shopify/ProductVariant/1', quantity: 1, attributes: [{ key: '_lensType', value: 'singleVision' }] }],
      })
    );
  });

  it('throws on user errors', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      cartLinesAdd: { cart: null, userErrors: [{ field: ['lines'], message: 'Variant not found' }] },
    });

    await expect(
      cartLinesAdd('gid://shopify/Cart/1', [{ merchandiseId: 'invalid', quantity: 1 }])
    ).rejects.toThrow('Cart lines add failed');
  });
});

describe('cartLinesUpdate', () => {
  it('updates line quantities and returns updated cart', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      cartLinesUpdate: { cart: mockRawCart, userErrors: [] },
    });

    const cart = await cartLinesUpdate('gid://shopify/Cart/1', [
      { id: 'gid://shopify/CartLine/1', quantity: 3 },
    ]);

    expect(cart.id).toBe('gid://shopify/Cart/1');
  });

  it('throws on user errors', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      cartLinesUpdate: { cart: null, userErrors: [{ field: ['lines'], message: 'Line not found' }] },
    });

    await expect(
      cartLinesUpdate('gid://shopify/Cart/1', [{ id: 'invalid', quantity: 1 }])
    ).rejects.toThrow('Cart lines update failed');
  });
});

describe('cartLinesRemove', () => {
  it('removes lines and returns updated cart', async () => {
    const emptyCart = {
      ...mockRawCart,
      lines: { nodes: [] },
      cost: {
        subtotalAmount: { amount: '0.00', currencyCode: 'CAD' },
        totalAmount: { amount: '0.00', currencyCode: 'CAD' },
      },
    };

    mockStorefrontFetch.mockResolvedValueOnce({
      cartLinesRemove: { cart: emptyCart, userErrors: [] },
    });

    const cart = await cartLinesRemove('gid://shopify/Cart/1', ['gid://shopify/CartLine/1']);
    expect(cart.lines).toHaveLength(0);
  });

  it('throws on user errors', async () => {
    mockStorefrontFetch.mockResolvedValueOnce({
      cartLinesRemove: { cart: null, userErrors: [{ field: ['lineIds'], message: 'Invalid line' }] },
    });

    await expect(
      cartLinesRemove('gid://shopify/Cart/1', ['invalid'])
    ).rejects.toThrow('Cart lines remove failed');
  });
});
