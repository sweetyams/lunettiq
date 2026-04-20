'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/shared/ProductCard';

interface Product { id: string; handle: string; title: string; imageUrl: string | null; price: string; vendor: string | null }

interface WishlistClientProps {
  initialProductIds: string[];
}

export default function WishlistClient({ initialProductIds }: WishlistClientProps) {
  const [productIds, setProductIds] = useState<string[]>(initialProductIds);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Merge localStorage wishlist with server data
  useEffect(() => {
    try {
      const local: string[] = JSON.parse(localStorage.getItem('lunettiq_wishlist') ?? '[]');
      const merged = Array.from(new Set([...initialProductIds, ...local]));
      setProductIds(merged);
    } catch {}
  }, [initialProductIds]);

  // Fetch product details
  useEffect(() => {
    if (!productIds.length) { setLoading(false); return; }
    fetch(`/api/wishlist-products?ids=${productIds.join(',')}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setProducts(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productIds]);

  if (loading) return <div className="text-center py-16 text-gray-400">Loading…</div>;

  if (!productIds.length) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Your wishlist is empty.</p>
        <Link href="/collections/optics" className="inline-block px-6 py-2 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors">
          Browse Eyewear
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
      {products.map(p => (
        <ProductCard key={p.id} light={{ id: p.id, handle: p.handle, title: p.title, imageUrl: p.imageUrl, price: p.price, vendor: p.vendor }} className="w-full" />
      ))}
      {productIds.filter(id => !products.find(p => p.id === id)).map(id => (
        <div key={id} className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center">
          <div className="text-center text-xs text-gray-400">
            <div className="text-2xl mb-1">👓</div>
            <div>Product unavailable</div>
          </div>
        </div>
      ))}
    </div>
  );
}
