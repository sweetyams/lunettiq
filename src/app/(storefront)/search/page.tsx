'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProductCard, { type ProductCardLightProps } from '@/components/shared/ProductCard';

const CATEGORIES = [
  { label: 'Optical', href: '/collections/optics' },
  { label: 'Sun', href: '/collections/sun' },
  { label: 'Collections', href: '/collections' },
];

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const [products, setProducts] = useState<ProductCardLightProps[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback(async () => {
    if (!q) { setProducts([]); setTotal(0); setLoading(false); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/storefront/search?q=${encodeURIComponent(q)}&limit=24`, { signal: controller.signal });
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error(e);
    }
    setLoading(false);
  }, [q]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  return (
    <div className="site-container py-8">
      {q && (
        <p className="text-sm text-gray-500 mb-6">
          {total > 0 ? `Showing ${total} result${total !== 1 ? 's' : ''} for '${q}'` : `No frames matching '${q}'`}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square bg-gray-100 rounded-lg mb-2" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div className="h-4 w-3/4 bg-gray-100 rounded mb-1" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div className="h-3 w-1/2 bg-gray-100 rounded" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {products.map(p => (
            <ProductCard key={p.id} light={p} className="w-full" />
          ))}
        </div>
      ) : q ? (
        <div className="text-center py-16">
          <p className="text-lg text-gray-600 mb-6">No frames matching '{q}'</p>
          <p className="text-sm text-gray-400 mb-6">Browse by category:</p>
          <div className="flex justify-center gap-3 mb-8">
            {CATEGORIES.map(c => (
              <Link key={c.href} href={c.href}
                className="px-5 py-2.5 text-sm bg-gray-100 rounded-full hover:bg-black hover:text-white transition-colors">{c.label}</Link>
            ))}
          </div>
          <Link href="/pages/stores" className="text-sm text-gray-400 underline hover:text-black">Book a styling consultation</Link>
        </div>
      ) : null}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
