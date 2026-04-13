import Image from 'next/image';
import Link from 'next/link';
import type { EditorialPanel as EditorialPanelType } from '@/types/metaobjects';

interface EditorialPanelProps {
  panel: EditorialPanelType;
}

export default function EditorialPanel({ panel }: EditorialPanelProps) {
  const content = (
    <div className="relative w-full h-[600px] md:h-[960px] overflow-hidden">
      {panel.image && (
        <Image
          src={panel.image}
          alt={panel.title}
          fill
          className="object-cover"
          sizes="100vw"
        />
      )}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-white text-2xl md:text-4xl font-light tracking-wide mb-4">
          {panel.title}
        </h2>
        {panel.body && (
          <p className="text-white/90 text-sm md:text-base max-w-xl leading-relaxed">
            {panel.body}
          </p>
        )}
      </div>
    </div>
  );

  if (panel.linkUrl) {
    return (
      <Link href={panel.linkUrl} className="block">
        {content}
      </Link>
    );
  }

  return <section>{content}</section>;
}
