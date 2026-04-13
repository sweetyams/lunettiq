'use client';

import type { Product } from '@/types/shopify';
import ProductCard from '@/components/shared/ProductCard';
import { StaggerContainer, StaggerItem } from '@/components/shared/Stagger';

interface RecommendationsProps {
  products: Product[];
}

export default function Recommendations({ products }: RecommendationsProps) {
  if (products.length === 0) return null;

  return (
    <section aria-label="Recommended products">
      <h2 className="text-xl font-light tracking-wide mb-6">You may also like</h2>

      <StaggerContainer className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:overflow-visible">
        {products.slice(0, 8).map((product) => (
          <StaggerItem
            key={product.id}
            className="w-[calc(50%-8px)] flex-shrink-0 md:w-auto"
          >
            <ProductCard product={product} className="w-full" />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
