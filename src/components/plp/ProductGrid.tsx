'use client';

import type { Product } from '@/types/shopify';
import type { EditorialPanel as EditorialPanelType } from '@/types/metaobjects';
import ProductCard from '@/components/shared/ProductCard';
import EditorialPanel from '@/components/home/EditorialPanel';

interface ProductGridProps {
  products: Product[];
  editorialPanels: EditorialPanelType[];
  editorialInterval: number;
}

/**
 * Renders products in a responsive grid with editorial breaks injected
 * at defined intervals (after every `editorialInterval` products).
 */
export default function ProductGrid({
  products,
  editorialPanels,
  editorialInterval,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500 text-lg">No products found.</p>
        <p className="text-gray-400 text-sm mt-2">Try adjusting your filters.</p>
      </div>
    );
  }

  // Build grid items: products interspersed with editorial panels
  const gridItems: Array<
    | { type: 'product'; product: Product; key: string }
    | { type: 'editorial'; panel: EditorialPanelType; key: string }
  > = [];

  let editorialIndex = 0;

  products.forEach((product, index) => {
    gridItems.push({
      type: 'product',
      product,
      key: `product-${product.id}`,
    });

    // After every `editorialInterval` products, inject an editorial panel
    const productPosition = index + 1;
    if (
      productPosition > 0 &&
      productPosition % editorialInterval === 0 &&
      editorialIndex < editorialPanels.length
    ) {
      gridItems.push({
        type: 'editorial',
        panel: editorialPanels[editorialIndex],
        key: `editorial-${editorialIndex}`,
      });
      editorialIndex++;
    }
  });

  return (
    <div>
      {/* Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {gridItems.map((item) => {
          if (item.type === 'editorial') {
            return (
              <div key={item.key} className="col-span-1 sm:col-span-2 lg:col-span-3">
                <EditorialPanel panel={item.panel} />
              </div>
            );
          }

          return (
            <div key={item.key}>
              <ProductCard product={item.product} className="w-full" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
