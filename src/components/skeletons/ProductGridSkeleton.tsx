import ProductCardSkeleton from './ProductCardSkeleton';

export default function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {Array.from({ length: 6 }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
