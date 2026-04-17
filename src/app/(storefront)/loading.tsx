import HeroSkeleton from '@/components/skeletons/HeroSkeleton';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';

export default function HomeLoading() {
  return (
    <>
      <HeroSkeleton />
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}
