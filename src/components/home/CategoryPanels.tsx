import Image from 'next/image';
import Link from 'next/link';
import type { CategoryPanel } from '@/types/metaobjects';

interface CategoryPanelsProps {
  panels: CategoryPanel[];
}

export default function CategoryPanels({ panels }: CategoryPanelsProps) {
  if (!panels.length) return null;

  // Split panels into groups: first 2 (Optical/Sun) and remaining (sub-collections)
  const primaryPanels = panels.slice(0, 2);
  const secondaryPanels = panels.slice(2);

  return (
    <>
      {/* Primary category entry: Glasses / Sunglasses — two panels side by side */}
      {primaryPanels.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 w-full">
          {primaryPanels.map((panel) => (
            <CategoryCard key={panel.collectionHandle} panel={panel} />
          ))}
        </section>
      )}

      {/* Secondary category entry: Signature / Permanent / Archives — three equal-width panels */}
      {secondaryPanels.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 w-full">
          {secondaryPanels.map((panel) => (
            <CategoryCard key={panel.collectionHandle} panel={panel} />
          ))}
        </section>
      )}
    </>
  );
}

function CategoryCard({ panel }: { panel: CategoryPanel }) {
  return (
    <Link
      href={`/collections/${panel.collectionHandle}`}
      className="relative group aspect-[4/5] overflow-hidden block"
    >
      {panel.image && (
        <Image
          src={panel.image}
          alt={panel.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      )}
      <div className="absolute inset-0 bg-black/10" />
      <span className="absolute bottom-6 left-6 text-white text-lg md:text-xl tracking-wide uppercase transition-transform duration-300 group-hover:-translate-y-1">
        {panel.title}
      </span>
    </Link>
  );
}
