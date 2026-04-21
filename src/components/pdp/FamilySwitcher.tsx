'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Sibling {
  colour: string;
  hex: string | null;
  optical: { productId: string; handle: string; title: string; image: string | null } | null;
  sun: { productId: string; handle: string; title: string; image: string | null } | null;
}

interface FamilyData {
  currentProductId: string;
  siblings: Sibling[];
}

interface FamilySwitcherProps {
  productId: string;
  productHandle: string;
  currentType: 'optical' | 'sun';
}

export default function FamilySwitcher({ productId, productHandle, currentType }: FamilySwitcherProps) {
  const [data, setData] = useState<FamilyData | null>(null);

  useEffect(() => {
    fetch(`/api/storefront/family/${encodeURIComponent(productHandle)}`)
      .then(r => r.json())
      .then(d => { if (d.data) setData(d.data); })
      .catch(() => {});
  }, [productHandle]);

  if (!data || data.siblings.length === 0) return null;

  // Find current colour
  const currentSibling = data.siblings.find(s =>
    s.optical?.handle === productHandle || s.sun?.handle === productHandle
  );

  // Type toggle: does this family have both optical and sun?
  const hasOptical = data.siblings.some(s => s.optical);
  const hasSun = data.siblings.some(s => s.sun);
  const hasBothTypes = hasOptical && hasSun;

  // Show if multiple colours OR can switch type
  if (data.siblings.length < 2 && !hasBothTypes) return null;

  return (
    <div className="space-y-5">
      {/* Optical / Sun toggle */}
      {hasBothTypes && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Type</p>
          <div className="inline-flex border border-gray-200 rounded-full overflow-hidden">
            <TypeButton
              label="Optical"
              active={currentType === 'optical'}
              href={currentType === 'optical' ? undefined : (currentSibling?.optical ? `/products/${currentSibling.optical.handle}` : undefined)}
            />
            <TypeButton
              label="Sunglasses"
              active={currentType === 'sun'}
              href={currentType === 'sun' ? undefined : (currentSibling?.sun ? `/products/${currentSibling.sun.handle}` : undefined)}
            />
          </div>
        </div>
      )}

      {/* Colour options with product images */}
      {data.siblings.length > 1 && (
      <div>
        <p className="text-sm text-gray-600 mb-3">
          Colour: <span className="text-black font-medium">{formatColour(currentSibling?.colour)}</span>
        </p>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour options">
          {data.siblings.map(s => {
            const product = currentType === 'sun' ? s.sun : s.optical;
            if (!product) return null;
            const isActive = product.handle === productHandle;

            return (
              <Link
                key={s.colour}
                href={`/products/${product.handle}`}
                className={`relative block overflow-hidden transition-all ${
                  isActive
                    ? 'ring-2 ring-black ring-offset-2'
                    : 'ring-1 ring-gray-200 hover:ring-gray-400'
                }`}
                style={{ width: 64, height: 80 }}
                role="radio"
                aria-checked={isActive}
                aria-label={formatColour(s.colour)}
              >
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={formatColour(s.colour)}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: s.hex || '#F5F5F9' }}>
                    <span className="text-[10px] text-gray-500 text-center px-1">{formatColour(s.colour)}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

function TypeButton({ label, active, href }: { label: string; active: boolean; href?: string }) {
  const base = "px-5 py-2 text-sm font-medium transition-colors";
  const cls = active
    ? `${base} bg-black text-white`
    : `${base} bg-white text-gray-600 hover:bg-gray-50`;

  if (!href || active) return <span className={cls}>{label}</span>;
  return <Link href={href} className={cls}>{label}</Link>;
}

function formatColour(colour: string | null | undefined): string {
  if (!colour) return '';
  return colour.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
