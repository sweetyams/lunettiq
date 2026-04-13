export default function HeroSkeleton() {
  return (
    <section className="w-full">
      <div className="flex flex-col md:flex-row w-full">
        <div className="w-full md:w-1/2 aspect-[4/5] bg-[#F5F5F9] animate-pulse" />
        <div className="w-full md:w-1/2 aspect-[4/5] bg-[#F5F5F9] animate-pulse" />
      </div>
    </section>
  );
}
