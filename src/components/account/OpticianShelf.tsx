'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Recommendation {
  productId: string;
  staffName?: string;
  date: string;
}

interface ProductPreview {
  handle: string;
  title: string;
  imageUrl: string | null;
  priceMin: string;
}

interface Props {
  recommendations: Recommendation[];
  opticianName: string | null;
}

export default function OpticianShelf({ recommendations, opticianName }: Props) {
  const [products, setProducts] = useState<(ProductPreview & { date: string })[]>([]);

  useEffect(() => {
    const ids = recommendations.slice(0, 6).map(r => r.productId);
    if (ids.length === 0) return;
    fetch(`/api/account/personalization/products?ids=${ids.join(',')}`)
      .then(r => r.json())
      .then(data => {
        const map = new Map((data.products ?? []).map((p: ProductPreview & { id: string }) => [p.id, p]));
        setProducts(
          recommendations.slice(0, 6)
            .map(r => {
              const p = map.get(r.productId) as ProductPreview | undefined;
              return p ? { ...p, date: r.date } : null;
            })
            .filter(Boolean) as (ProductPreview & { date: string })[]
        );
      })
      .catch(() => {});
  }, [recommendations]);

  if (products.length === 0) return null;

  const name = opticianName || 'Your optician';

  return (
    <section className="border border-gray-200 rounded-lg p-6">
      <h2 className="text-sm font-medium mb-1">{name}'s picks for you</h2>
      <p className="text-xs text-gray-400 mb-4">Hand-selected frames from your named optician</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {products.map(p => (
          <Link key={p.handle} href={`/products/${p.handle}`} className="group">
            {p.imageUrl && (
              <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden mb-2">
                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
            )}
            <p className="text-xs font-medium truncate">{p.title}</p>
            <p className="text-xs text-gray-400">Picked {new Date(p.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
