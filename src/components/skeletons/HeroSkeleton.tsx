export default function HeroSkeleton() {
  return (
    <section className="w-full">
      <div className="flex flex-col md:flex-row w-full">
        <div className="w-full md:w-1/2 aspect-[4/5] skeleton-shimmer" />
        <div className="w-full md:w-1/2 aspect-[4/5] skeleton-shimmer" />
      </div>
    </section>
  );
}
