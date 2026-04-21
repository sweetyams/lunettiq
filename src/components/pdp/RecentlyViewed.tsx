'use client';

import { useState, useEffect } from 'react';
import type { Product } from '@/types/shopify';
import ProductCard from '@/components/shared/ProductCard';

const STORAGE_KEY = 'lunettiq_recently_viewed';
const MAX_ITEMS = 8;

interface ViewedProduct { id: string; slug: string; title: string; imageUrl: string | null; price: string }

export function trackProductView(product: Product, slug: string) {
  if (typeof window === 'undefined') return;
  try {
    const stored: ViewedProduct[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const filtered = stored.filter(p => p.id !== product.id);
    filtered.unshift({
      id: product.id, slug, title: product.title,
      imageUrl: product.images[0]?.url ?? null,
      price: product.priceRange.minVariantPrice.amount,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  } catch {}
}

export default function RecentlyViewed({ currentProductId }: { currentProductId?: string }) {
  const [products, setProducts] = useState<ViewedProduct[]>([]);

  useEffect(() => {
    try {
      const stored: ViewedProduct[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      setProducts(currentProductId ? stored.filter(p => p.id !== currentProductId) : stored);
    } catch {}
  }, [currentProductId]);

  if (products.length === 0) return null;

  return (
    <div className="py-12">
      <h2 className="text-lg font-medium mb-6">Recently Viewed</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {products.slice(0, 3).map(p => (
          <ProductCard key={p.id} light={p} className="w-full" />
        ))}
      </div>
    </div>
  );
}
