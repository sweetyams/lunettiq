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
/*  API helper                                                         */
/* ------------------------------------------------------------------ */

async function cartApi(body: Record<string, unknown>): Promise<ShopifyCart> {
  const res = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Cart API error ${res.status}`);
  }
  return res.json();
}

async function fetchCart(cartId: string): Promise<ShopifyCart | null> {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fetch', cartId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.id) return null;
    // Normalize the raw Storefront response into our ShopifyCart shape
    return {
      id: data.id,
      checkoutUrl: data.checkoutUrl,
      lines: (data.lines?.nodes ?? []).map((n: Record<string, unknown> & { id: string; quantity: number; merchandise: ShopifyCart['lines'][number]['merchandise']; attributes: CartLineAttribute[]; cost: { totalAmount: { amount: string; currencyCode: string } } }) => ({
        id: n.id,
        quantity: n.quantity,
        merchandise: n.merchandise,
        attributes: n.attributes,
        cost: n.cost,
      })),
      cost: data.cost,
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
  isLoading: boolean;
  isCheckingOut: boolean;
  addToCart: (variantId: string, quantity: number, attributes?: CartLineAttribute[]) => Promise<void>;
  addLinesToCart: (lines: { variantId: string; quantity: number; attributes?: CartLineAttribute[] }[]) => Promise<void>;
  updateLineItem: (lineId: string, quantity: number) => Promise<void>;
  removeLineItem: (lineId: string) => Promise<void>;
  checkout: (discount?: { code: string; title: string; type: string; value: number }) => Promise<string>;
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
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const initialised = useRef(false);

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
          clearCartIdCookie();
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const ensureCart = useCallback(async (): Promise<string> => {
    if (cart) return cart.id;
    const newCart = await cartApi({ action: 'create' });
    setCart(newCart);
    setCartIdCookie(newCart.id);
    return newCart.id;
  }, [cart]);

  const addToCart = useCallback(
    async (variantId: string, quantity: number, attributes?: CartLineAttribute[]) => {
      setIsLoading(true);
      try {
        const cartId = await ensureCart();
        const lines = [{ merchandiseId: variantId, quantity, attributes }];
        try {
          const updated = await cartApi({ action: 'addLines', cartId, lines });
          setCart(updated);
          setCartIdCookie(updated.id);
        } catch {
          clearCartIdCookie();
          const newCart = await cartApi({ action: 'create', input: { lines } });
          setCart(newCart);
          setCartIdCookie(newCart.id);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [ensureCart]
  );

  const addLinesToCart = useCallback(
    async (items: { variantId: string; quantity: number; attributes?: CartLineAttribute[] }[]) => {
      if (!items.length) return;
      setIsLoading(true);
      try {
        const cartId = await ensureCart();
        const lines = items.map(i => ({ merchandiseId: i.variantId, quantity: i.quantity, attributes: i.attributes }));
        try {
          const updated = await cartApi({ action: 'addLines', cartId, lines });
          setCart(updated);
          setCartIdCookie(updated.id);
        } catch {
          clearCartIdCookie();
          const newCart = await cartApi({ action: 'create', input: { lines } });
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
        const updated = await cartApi({
          action: 'updateLines',
          cartId: cart.id,
          lines: [{ id: lineId, quantity }],
        });
        setCart(updated);
      } catch {
        clearCartIdCookie();
        setCart(null);
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
        const updated = await cartApi({
          action: 'removeLines',
          cartId: cart.id,
          lineIds: [lineId],
        });
        setCart(updated);
      } catch {
        clearCartIdCookie();
        setCart(null);
      } finally {
        setIsLoading(false);
      }
    },
    [cart]
  );

  const checkout = useCallback(async (discount?: { code: string; title: string; type: string; value: number }): Promise<string> => {
    if (!cart || cart.lines.length === 0) throw new Error('Cart is empty');
    setIsCheckingOut(true);
    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: cart.id, discount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Checkout failed');
      }
      const { invoiceUrl } = await res.json();
      return invoiceUrl;
    } finally {
      setIsCheckingOut(false);
    }
  }, [cart]);

  return (
    <CartContext.Provider value={{ cart, isLoading, isCheckingOut, addToCart, addLinesToCart, updateLineItem, removeLineItem, checkout }}>
      {children}
    </CartContext.Provider>
  );
}
