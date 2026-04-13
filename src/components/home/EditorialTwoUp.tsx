import Image from 'next/image';
import Link from 'next/link';
import type { EditorialPanel } from '@/types/metaobjects';

interface EditorialTwoUpProps {
  panels: EditorialPanel[];
}

export default function EditorialTwoUp({ panels }: EditorialTwoUpProps) {
  if (panels.length < 2) return null;

  const [left, right] = panels;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 md:px-8 py-8">
      {[left, right].map((panel) => {
        const inner = (
          <div className="relative aspect-[4/5] overflow-hidden">
            {panel.image && (
              <Image
                src={panel.image}
                alt={panel.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            )}
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute bottom-6 left-6">
              <h3 className="text-white text-lg md:text-xl tracking-wide">
                {panel.title}
              </h3>
            </div>
          </div>
        );

        return panel.linkUrl ? (
          <Link key={panel.title} href={panel.linkUrl} className="block">
            {inner}
          </Link>
        ) : (
          <div key={panel.title}>{inner}</div>
        );
      })}
    </section>
  );
}
