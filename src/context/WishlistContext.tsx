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
import type { WishlistData } from '@/types/customer';

const ACCESS_TOKEN_COOKIE = 'lunettiq_access_token';

function hasAccessToken(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes(ACCESS_TOKEN_COOKIE);
}

interface WishlistContextValue {
  items: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  addToWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}

async function fetchWishlist(): Promise<string[]> {
  const res = await fetch('/api/account/wishlist');
  if (!res.ok) return [];
  const data: WishlistData = await res.json();
  return data.productIds ?? [];
}

async function saveWishlist(productIds: string[]): Promise<void> {
  await fetch('/api/account/wishlist', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productIds }),
  });
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const authed = hasAccessToken();
    setIsAuthenticated(authed);
    if (!authed) return;

    setIsLoading(true);
    fetchWishlist()
      .then(setItems)
      .finally(() => setIsLoading(false));
  }, []);

  const addToWishlist = useCallback(
    async (productId: string) => {
      const updated = [...items, productId];
      setItems(updated);
      await saveWishlist(updated);
      import('@/lib/tracking').then(({ track }) => {
        track({ event: 'add_to_wishlist', data: { id: productId, name: '', price: 0 } });
      });
    },
    [items]
  );

  const removeFromWishlist = useCallback(
    async (productId: string) => {
      const updated = items.filter((id) => id !== productId);
      setItems(updated);
      await saveWishlist(updated);
    },
    [items]
  );

  const isInWishlist = useCallback(
    (productId: string) => items.includes(productId),
    [items]
  );

  return (
    <WishlistContext.Provider
      value={{ items, isLoading, isAuthenticated, addToWishlist, removeFromWishlist, isInWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
}
