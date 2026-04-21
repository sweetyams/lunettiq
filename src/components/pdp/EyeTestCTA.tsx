import Image from 'next/image';
import Link from 'next/link';
import type { EyeTestCTA } from '@/types/metaobjects';

interface EyeTestCTABlockProps {
  cta: EyeTestCTA;
}

export default function EyeTestCTABlock({ cta }: EyeTestCTABlockProps) {
  return (
    <section
      className="relative overflow-hidden bg-[var(--product-card-bg,#F5F5F9)]"
      aria-label="Eye test booking"
    >
      <div className="flex flex-col md:flex-row items-center">
        {/* Image (optional) */}
        {cta.image && (
          <div className="relative w-full md:w-1/2 h-[300px] md:h-[400px]">
            <Image
              src={cta.image}
              alt={cta.heading}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        )}

        {/* Content */}
        <div
          className={`p-8 md:p-12 ${
            cta.image ? 'w-full md:w-1/2' : 'w-full text-center'
          }`}
        >
          <h2 className="text-xl md:text-2xl font-light tracking-wide mb-4">
            {cta.heading}
          </h2>
          {cta.body && (
            <p className="text-sm text-gray-600 leading-relaxed mb-6 max-w-md">
              {cta.body}
            </p>
          )}
          <Link
            href={cta.ctaLink}
            className="inline-block px-8 py-3 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {cta.ctaText}
          </Link>
        </div>
      </div>
    </section>
  );
}
