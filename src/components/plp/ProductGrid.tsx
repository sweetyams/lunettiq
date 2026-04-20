'use client';

import { useMemo } from 'react';
import type { Product } from '@/types/shopify';
import type { EditorialPanel as EditorialPanelType } from '@/types/metaobjects';
import ProductCard from '@/components/shared/ProductCard';
import EditorialPanel from '@/components/home/EditorialPanel';

interface ProductGridProps {
  products: Product[];
  editorialPanels: EditorialPanelType[];
  editorialInterval: number;
  skipAnimation?: boolean;
}

export default function ProductGrid({
  products,
  editorialPanels,
  editorialInterval,
  skipAnimation = false,
}: ProductGridProps) {
  const gridItems = useMemo(() => {
    const items: Array<
      | { type: 'product'; product: Product; key: string; index: number }
      | { type: 'editorial'; panel: EditorialPanelType; key: string; index: number }
    > = [];
    let editorialIndex = 0;

    products.forEach((product, index) => {
      items.push({ type: 'product', product, key: `product-${product.id}`, index });
      const pos = index + 1;
      if (pos % editorialInterval === 0 && editorialIndex < editorialPanels.length) {
        items.push({
          type: 'editorial',
          panel: editorialPanels[editorialIndex],
          key: `editorial-${editorialIndex}`,
          index: index + 1,
        });
        editorialIndex++;
      }
    });
    return items;
  }, [products, editorialPanels, editorialInterval]);

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500 text-lg">No products found.</p>
        <p className="text-gray-400 text-sm mt-2">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
      {gridItems.map((item) => {
        const content = item.type === 'editorial' ? (
          <div className="col-span-1 sm:col-span-2 lg:col-span-3">
            <EditorialPanel panel={item.panel} />
          </div>
        ) : (
          <ProductCard product={item.product} className="w-full" prefetch={false} />
        );

        if (skipAnimation) return <div key={item.key}>{content}</div>;

        return (
          <div
            key={item.key}
            className="plp-animate"
            style={{ animationDelay: `${item.index * 0.06}s` }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
