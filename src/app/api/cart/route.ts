import { NextResponse } from 'next/server';
import { cartCreate, cartLinesAdd, cartLinesUpdate, cartLinesRemove } from '@/lib/shopify/mutations/cart';
import { storefrontFetch } from '@/lib/shopify/storefront';

const CART_QUERY = `
  query CartQuery($cartId: ID!) {
    cart(id: $cartId) {
      id
      checkoutUrl
      lines(first: 100) {
        nodes {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount currencyCode }
              availableForSale
              selectedOptions { name value }
              image { url altText width height }
            }
          }
          attributes { key value }
          cost { totalAmount { amount currencyCode } }
        }
      }
      cost {
        subtotalAmount { amount currencyCode }
        totalAmount { amount currencyCode }
      }
    }
  }
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, cartId, lines, lineIds, input } = body;

    switch (action) {
      case 'create': {
        const cart = await cartCreate(input ?? {});
        return NextResponse.json(cart);
      }
      case 'addLines': {
        if (!cartId || !lines) return NextResponse.json({ error: 'Missing cartId or lines' }, { status: 400 });
        const cart = await cartLinesAdd(cartId, lines);
        return NextResponse.json(cart);
      }
      case 'updateLines': {
        if (!cartId || !lines) return NextResponse.json({ error: 'Missing cartId or lines' }, { status: 400 });
        const cart = await cartLinesUpdate(cartId, lines);
        return NextResponse.json(cart);
      }
      case 'removeLines': {
        if (!cartId || !lineIds) return NextResponse.json({ error: 'Missing cartId or lineIds' }, { status: 400 });
        const cart = await cartLinesRemove(cartId, lineIds);
        return NextResponse.json(cart);
      }
      case 'fetch': {
        if (!cartId) return NextResponse.json({ error: 'Missing cartId' }, { status: 400 });
        const data = await storefrontFetch<{ cart: unknown }>(CART_QUERY, { cartId });
        return NextResponse.json(data.cart);
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cart operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
