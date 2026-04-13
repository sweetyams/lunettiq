'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { ShopifyCart, CartLineAttribute } from '@/types/shopify';
import {
  cartCreate,
  cartLinesAdd,
  cartLinesUpdate,
  cartLinesRemove,
  type CartLineInput,
  type CartLineUpdateInput,
} from '@/lib/shopify/mutations/cart';

/* ------------------------------------------------------------------ */
/*  Cookie helpers                                                     */
/* ------------------------------------------------------------------ */

const CART_COOKIE = 'lunettiq_cart_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function getCartIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CART_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCartIdCookie(cartId: string): void {
  document.cookie = `${CART_COOKIE}=${encodeURIComponent(cartId)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearCartIdCookie(): void {
  document.cookie = `${CART_COOKIE}=; path=/; max-age=0`;
}

/* ------------------------------------------------------------------ */
/*  Fetch cart query (lightweight — reuses storefront client)          */
/* ------------------------------------------------------------------ */

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

async function fetchCart(cartId: string): Promise<ShopifyCart | null> {
  try {
    const { storefrontFetch } = await import('@/lib/shopify/storefront');
    const data = await storefrontFetch<{ cart: {
      id: string;
      checkoutUrl: string;
      lines: { nodes: Array<{
        id: string;
        quantity: number;
        merchandise: ShopifyCart['lines'][number]['merchandise'];
        attributes: CartLineAttribute[];
        cost: { totalAmount: { amount: string; currencyCode: string } };
      }> };
      cost: {
        subtotalAmount: { amount: string; currencyCode: string };
        totalAmount: { amount: string; currencyCode: string };
      };
    } | null }>(CART_QUERY, { cartId });

    if (!data.cart) return null;

    return {
      id: data.cart.id,
      checkoutUrl: data.cart.checkoutUrl,
      lines: data.cart.lines.nodes.map((n) => ({
        id: n.id,
        quantity: n.quantity,
        merchandise: n.merchandise,
        attributes: n.attributes,
        cost: n.cost,
      })),
      cost: data.cart.cost,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface CartContextValue {
  cart: ShopifyCart | null;
  isOpen: boolean;
  isLoading: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (variantId: string, quantity: number, attributes?: CartLineAttribute[]) => Promise<void>;
  updateLineItem: (lineId: string, quantity: number) => Promise<void>;
  removeLineItem: (lineId: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<ShopifyCart | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const initialised = useRef(false);

  // On mount: recover cart from cookie
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const cartId = getCartIdFromCookie();
    if (!cartId) return;

    setIsLoading(true);
    fetchCart(cartId)
      .then((fetched) => {
        if (fetched) {
          setCart(fetched);
        } else {
          // Cart expired or invalid — clear cookie
          clearCartIdCookie();
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  /**
   * Ensures a cart exists. Creates one if needed.
   * Returns the cart ID.
   */
  const ensureCart = useCallback(async (): Promise<string> => {
    if (cart) return cart.id;
    const newCart = await cartCreate();
    setCart(newCart);
    setCartIdCookie(newCart.id);
    return newCart.id;
  }, [cart]);

  const addToCart = useCallback(
    async (variantId: string, quantity: number, attributes?: CartLineAttribute[]) => {
      setIsLoading(true);
      try {
        const cartId = await ensureCart();
        const lines: CartLineInput[] = [{ merchandiseId: variantId, quantity, attributes }];
        try {
          const updated = await cartLinesAdd(cartId, lines);
          setCart(updated);
          setCartIdCookie(updated.id);
        } catch {
          // Cart recovery: if the cart is invalid, create a new one
          clearCartIdCookie();
          const newCart = await cartCreate({ lines });
          setCart(newCart);
          setCartIdCookie(newCart.id);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [ensureCart]
  );

  const updateLineItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (!cart) return;
      setIsLoading(true);
      try {
        const lines: CartLineUpdateInput[] = [{ id: lineId, quantity }];
        try {
          const updated = await cartLinesUpdate(cart.id, lines);
          setCart(updated);
        } catch {
          // Cart recovery
          clearCartIdCookie();
          setCart(null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [cart]
  );

  const removeLineItem = useCallback(
    async (lineId: string) => {
      if (!cart) return;
      setIsLoading(true);
      try {
        try {
          const updated = await cartLinesRemove(cart.id, [lineId]);
          setCart(updated);
        } catch {
          // Cart recovery
          clearCartIdCookie();
          setCart(null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [cart]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        isOpen,
        isLoading,
        openCart,
        closeCart,
        addToCart,
        updateLineItem,
        removeLineItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
