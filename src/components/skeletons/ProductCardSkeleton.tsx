export default function ProductCardSkeleton() {
  return (
    <div className="w-full">
      <div className="skeleton-shimmer rounded" style={{ aspectRatio: '463/579' }} />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 skeleton-shimmer rounded" />
        <div className="h-4 w-1/2 skeleton-shimmer rounded" />
        <div className="h-3 w-1/3 skeleton-shimmer rounded" />
      </div>
    </div>
  );
}
