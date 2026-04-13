export default function ProductCardSkeleton() {
  return (
    <div className="w-full">
      <div className="bg-[#F5F5F9] animate-pulse" style={{ aspectRatio: '463/579' }} />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 bg-[#F5F5F9] animate-pulse rounded" />
        <div className="h-4 w-1/2 bg-[#F5F5F9] animate-pulse rounded" />
        <div className="h-3 w-1/3 bg-[#F5F5F9] animate-pulse rounded" />
      </div>
    </div>
  );
}
