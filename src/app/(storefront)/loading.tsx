import HeroSkeleton from '@/components/skeletons/HeroSkeleton';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';

export default function HomeLoading() {
  return (
    <>
      <HeroSkeleton />
      <div className="site-container py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 3 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}
