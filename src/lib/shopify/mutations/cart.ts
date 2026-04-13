import { storefrontFetch } from '../storefront';
import type { ShopifyCart, CartLineAttribute } from '@/types/shopify';

// --- Shared cart fragment ---

const CART_FRAGMENT = `
  fragment CartFields on Cart {
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
            price {
              amount
              currencyCode
            }
            availableForSale
            selectedOptions {
              name
              value
            }
            image {
              url
              altText
              width
              height
            }
          }
        }
        attributes {
          key
          value
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
      }
    }
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
      totalAmount {
        amount
        currencyCode
      }
    }
  }
`;

// --- cartCreate ---

const CART_CREATE_MUTATION = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
  ${CART_FRAGMENT}
`;

interface CartCreateInput {
  lines?: Array<{
    merchandiseId: string;
    quantity: number;
    attributes?: CartLineAttribute[];
  }>;
}

interface CartMutationResponse {
  cart: RawCart | null;
  userErrors: Array<{ field: string[]; message: string }>;
}

interface RawCart {
  id: string;
  checkoutUrl: string;
  lines: {
    nodes: Array<{
      id: string;
      quantity: number;
      merchandise: ShopifyCart['lines'][number]['merchandise'];
      attributes: CartLineAttribute[];
      cost: { totalAmount: { amount: string; currencyCode: string } };
    }>;
  };
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
}

function parseCart(raw: RawCart): ShopifyCart {
  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    lines: raw.lines.nodes.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      merchandise: line.merchandise,
      attributes: line.attributes,
      cost: line.cost,
    })),
    cost: raw.cost,
  };
}

export async function cartCreate(input: CartCreateInput = {}): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartCreate: CartMutationResponse }>(
    CART_CREATE_MUTATION,
    { input }
  );

  if (data.cartCreate.userErrors.length > 0) {
    throw new Error(
      `Cart create failed: ${data.cartCreate.userErrors.map((e) => e.message).join(', ')}`
    );
  }

  return parseCart(data.cartCreate.cart!);
}

// --- cartLinesAdd ---

const CART_LINES_ADD_MUTATION = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
  ${CART_FRAGMENT}
`;

export interface CartLineInput {
  merchandiseId: string;
  quantity: number;
  attributes?: CartLineAttribute[];
}

export async function cartLinesAdd(
  cartId: string,
  lines: CartLineInput[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartLinesAdd: CartMutationResponse }>(
    CART_LINES_ADD_MUTATION,
    { cartId, lines }
  );

  if (data.cartLinesAdd.userErrors.length > 0) {
    throw new Error(
      `Cart lines add failed: ${data.cartLinesAdd.userErrors.map((e) => e.message).join(', ')}`
    );
  }

  return parseCart(data.cartLinesAdd.cart!);
}

// --- cartLinesUpdate ---

const CART_LINES_UPDATE_MUTATION = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
  ${CART_FRAGMENT}
`;

export interface CartLineUpdateInput {
  id: string;
  quantity: number;
}

export async function cartLinesUpdate(
  cartId: string,
  lines: CartLineUpdateInput[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartLinesUpdate: CartMutationResponse }>(
    CART_LINES_UPDATE_MUTATION,
    { cartId, lines }
  );

  if (data.cartLinesUpdate.userErrors.length > 0) {
    throw new Error(
      `Cart lines update failed: ${data.cartLinesUpdate.userErrors.map((e) => e.message).join(', ')}`
    );
  }

  return parseCart(data.cartLinesUpdate.cart!);
}

// --- cartLinesRemove ---

const CART_LINES_REMOVE_MUTATION = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
    }
  }
  ${CART_FRAGMENT}
`;

export async function cartLinesRemove(
  cartId: string,
  lineIds: string[]
): Promise<ShopifyCart> {
  const data = await storefrontFetch<{ cartLinesRemove: CartMutationResponse }>(
    CART_LINES_REMOVE_MUTATION,
    { cartId, lineIds }
  );

  if (data.cartLinesRemove.userErrors.length > 0) {
    throw new Error(
      `Cart lines remove failed: ${data.cartLinesRemove.userErrors.map((e) => e.message).join(', ')}`
    );
  }

  return parseCart(data.cartLinesRemove.cart!);
}

export {
  CART_FRAGMENT,
  CART_CREATE_MUTATION,
  CART_LINES_ADD_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_LINES_REMOVE_MUTATION,
};
