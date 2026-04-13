import type { Product } from '@/types/shopify';
import ProductCard from '@/components/shared/ProductCard';

interface ProductRowProps {
  products: Product[];
  title?: string;
}

export default function ProductRow({ products, title }: ProductRowProps) {
  if (!products.length) return null;

  return (
    <section className="w-full px-6 md:px-12 py-12 md:py-16">
      {title && (
        <h2 className="text-xl md:text-2xl tracking-wide mb-8">{title}</h2>
      )}
      {/* 4-column grid on desktop, horizontal scroll on mobile showing 2 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} className="w-full" />
        ))}
      </div>
    </section>
  );
}
