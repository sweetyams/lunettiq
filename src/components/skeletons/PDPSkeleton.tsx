export default function PDPSkeleton() {
  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 px-4 md:px-8 py-4 md:py-8">
          <div className="skeleton-shimmer aspect-[4/5] w-full rounded" />
        </div>
        <div className="w-full md:w-1/2 px-4 md:px-8 py-4 md:py-8 space-y-4">
          <div className="h-6 w-1/2 skeleton-shimmer rounded" />
          <div className="h-8 w-3/4 skeleton-shimmer rounded" />
          <div className="h-5 w-1/3 skeleton-shimmer rounded" />
          <div className="h-12 w-full skeleton-shimmer rounded mt-8" />
          <div className="h-48 w-full skeleton-shimmer rounded mt-4" />
        </div>
      </div>
    </div>
  );
}
