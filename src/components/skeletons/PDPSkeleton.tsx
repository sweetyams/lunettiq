export default function PDPSkeleton() {
  return (
    <div className="max-w-[1440px] mx-auto">
      <div className="flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 px-4 md:px-8 py-4 md:py-8">
          <div className="bg-[#F5F5F9] animate-pulse aspect-[4/5] w-full" />
        </div>
        <div className="w-full md:w-1/2 px-4 md:px-8 py-4 md:py-8 space-y-4">
          <div className="h-6 w-1/2 bg-[#F5F5F9] animate-pulse rounded" />
          <div className="h-8 w-3/4 bg-[#F5F5F9] animate-pulse rounded" />
          <div className="h-5 w-1/3 bg-[#F5F5F9] animate-pulse rounded" />
          <div className="h-12 w-full bg-[#F5F5F9] animate-pulse rounded mt-8" />
          <div className="h-48 w-full bg-[#F5F5F9] animate-pulse rounded mt-4" />
        </div>
      </div>
    </div>
  );
}
