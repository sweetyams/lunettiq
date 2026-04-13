import Image from 'next/image';
import Link from 'next/link';
import type { HomepageHero } from '@/types/metaobjects';

interface HeroSectionProps {
  heroes: HomepageHero[];
}

export default function HeroSection({ heroes }: HeroSectionProps) {
  const activeHero = heroes.find((h) => h.active);
  if (!activeHero) return null;

  return (
    <section className="relative w-full">
      {/* Dual images: side by side on desktop, stacked on mobile */}
      <div className="flex flex-col md:flex-row w-full">
        <div className="relative w-full md:w-1/2 aspect-[4/5]">
          {activeHero.imageLeft && (
            <Image
              src={activeHero.imageLeft}
              alt={activeHero.headline || 'Hero image left'}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          )}
        </div>
        <div className="relative w-full md:w-1/2 aspect-[4/5]">
          {activeHero.imageRight && (
            <Image
              src={activeHero.imageRight}
              alt={activeHero.headline || 'Hero image right'}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          )}
        </div>
      </div>

      {/* Headline overlay + CTA */}
      {(activeHero.headline || activeHero.ctaText) && (
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 md:pb-16 bg-gradient-to-t from-black/40 to-transparent">
          {activeHero.headline && (
            <h1 className="text-white text-3xl md:text-5xl font-light tracking-wide text-center mb-6 px-4">
              {activeHero.headline}
            </h1>
          )}
          {activeHero.ctaText && activeHero.ctaLink && (
            <Link
              href={activeHero.ctaLink}
              className="inline-block border border-white text-white text-sm tracking-widest uppercase px-8 py-3 hover:bg-white hover:text-black transition-colors"
            >
              {activeHero.ctaText}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
