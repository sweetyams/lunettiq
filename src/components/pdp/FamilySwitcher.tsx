'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import type { Product } from '@/types/shopify';

interface Sibling {
  colour: string;
  hex: string | null;
  optical: { productId: string; slug: string; title: string; image: string | null } | null;
  sun: { productId: string; slug: string; title: string; image: string | null } | null;
}

interface FamilyData {
  currentHandle: string;
  siblings: Sibling[];
}

interface FamilySwitcherProps {
  productHandle: string;
  currentType: 'optical' | 'sun';
  onNavigate: (product: Product, slug: string) => void;
}

// Module-level cache — survives component remounts, shared across instances
const productCache = new Map<string, Product>();
const inflightRequests = new Map<string, Promise<Product | null>>();

function fetchProduct(handle: string): Promise<Product | null> {
  if (productCache.has(handle)) return Promise.resolve(productCache.get(handle)!);

  const existing = inflightRequests.get(handle);
  if (existing) return existing;

  const promise = fetch(`/api/storefront/product/${encodeURIComponent(handle)}`)
    .then(r => r.json())
    .then(d => {
      const product = d.product as Product | null;
      if (product) productCache.set(handle, product);
      inflightRequests.delete(handle);
      return product;
    })
    .catch(() => {
      inflightRequests.delete(handle);
      return null;
    });

  inflightRequests.set(handle, promise);
  return promise;
}

export function seedProductCache(slug: string, product: Product) {
  productCache.set(slug, product);
}

export default function FamilySwitcher({ productHandle, currentType, onNavigate }: FamilySwitcherProps) {
  const [data, setData] = useState<FamilyData | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);
  const handleRef = useRef(productHandle);
  handleRef.current = productHandle;

  useEffect(() => {
    fetch(`/api/storefront/family/${encodeURIComponent(productHandle)}`)
      .then(r => r.json())
      .then(d => {
        if (d.data && handleRef.current === productHandle) setData(d.data);
      })
      .catch(() => {});
  }, [productHandle]);

  // Prefetch all sibling products once family data loads
  useEffect(() => {
    if (!data) return;
    for (const s of data.siblings) {
      if (s.optical && s.optical.slug !== productHandle) fetchProduct(s.optical.slug);
      if (s.sun && s.sun.slug !== productHandle) fetchProduct(s.sun.slug);
    }
  }, [data, productHandle]);

  const handleNav = useCallback(async (handle: string) => {
    if (handle === productHandle) return;
    setNavigating(handle);
    const product = await fetchProduct(handle);
    if (product && handleRef.current !== handle) {
      onNavigate(product, handle);
      window.history.pushState(null, '', `/products/${handle}`);
    }
    setNavigating(null);
  }, [productHandle, onNavigate]);

  if (!data || data.siblings.length === 0) return null;

  const currentSibling = data.siblings.find(s =>
    s.optical?.slug === productHandle || s.sun?.slug === productHandle
  );

  const hasOptical = data.siblings.some(s => s.optical);
  const hasSun = data.siblings.some(s => s.sun);
  const hasBothTypes = hasOptical && hasSun;

  if (data.siblings.length < 2 && !hasBothTypes) return null;

  return (
    <div className="space-y-5">
      {hasBothTypes && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Type</p>
          <div className="inline-flex border border-gray-200 rounded-full overflow-hidden">
            <TypeButton
              label="Optical"
              active={currentType === 'optical'}
              loading={navigating === currentSibling?.optical?.slug}
              onClick={currentType === 'optical' ? undefined : () => currentSibling?.optical && handleNav(currentSibling.optical.slug)}
            />
            <TypeButton
              label="Sunglasses"
              active={currentType === 'sun'}
              loading={navigating === currentSibling?.sun?.slug}
              onClick={currentType === 'sun' ? undefined : () => currentSibling?.sun && handleNav(currentSibling.sun.slug)}
            />
          </div>
        </div>
      )}

      {data.siblings.length > 1 && (
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Colour: <span className="text-black font-medium">{formatColour(currentSibling?.colour)}</span>
          </p>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour options">
            {data.siblings.map(s => {
              const product = currentType === 'sun' ? s.sun : s.optical;
              if (!product) return null;
              const isActive = product.slug === productHandle;

              return (
                <button
                  key={s.colour}
                  onClick={() => handleNav(product.slug)}
                  disabled={isActive}
                  className={`relative block overflow-hidden transition-all ${
                    isActive
                      ? 'ring-2 ring-black ring-offset-2'
                      : 'ring-1 ring-gray-200 hover:ring-gray-400'
                  } ${navigating === product.slug ? 'opacity-60' : ''}`}
                  style={{ width: 64, height: 80 }}
                  role="radio"
                  aria-checked={isActive}
                  aria-label={formatColour(s.colour)}
                >
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={formatColour(s.colour)}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: s.hex || 'var(--product-card-bg, #F5F5F9)' }}>
                      <span className="text-[10px] text-gray-500 text-center px-1">{formatColour(s.colour)}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TypeButton({ label, active, loading, onClick }: { label: string; active: boolean; loading?: boolean; onClick?: () => void }) {
  const base = "px-5 py-2 text-sm font-medium transition-colors";
  const cls = active
    ? `${base} bg-black text-white`
    : `${base} bg-white text-gray-600 hover:bg-gray-50`;

  if (!onClick || active) return <span className={cls}>{label}</span>;
  return <button onClick={onClick} className={cls} disabled={loading}>{label}</button>;
}

function formatColour(colour: string | null | undefined): string {
  if (!colour) return '';
  return colour.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
