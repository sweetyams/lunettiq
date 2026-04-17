import ProductGridSkeleton from '@/components/skeletons/ProductGridSkeleton';

export default function CollectionLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8">
      <div className="h-8 w-48 bg-[#F5F5F9] animate-pulse rounded mb-6" />
      <ProductGridSkeleton />
    </div>
  );
}
