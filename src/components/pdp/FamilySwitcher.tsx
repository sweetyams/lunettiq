'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  currentType: 'optical' | 'sun';
}

export default function FamilySwitcher({ productId, currentType }: FamilySwitcherProps) {
  const [data, setData] = useState<FamilyData | null>(null);

  useEffect(() => {
    const numId = productId.replace(/^gid:\/\/shopify\/Product\//, '');
    fetch(`/api/storefront/family/${numId}`)
      .then(r => r.json())
      .then(d => { if (d.data) setData(d.data); })
      .catch(() => {});
  }, [productId]);

  if (!data || data.siblings.length < 2) return null;

  // Find current colour
  const currentSibling = data.siblings.find(s =>
    s.optical?.productId === productId.replace(/^gid:\/\/shopify\/Product\//, '') ||
    s.sun?.productId === productId.replace(/^gid:\/\/shopify\/Product\//, '')
  );

  // Type toggle: does this family have both optical and sun?
  const hasOptical = data.siblings.some(s => s.optical);
  const hasSun = data.siblings.some(s => s.sun);
  const hasBothTypes = hasOptical && hasSun;

  // Get the alternate type product for current colour
  const alternateType = currentSibling
    ? (currentType === 'optical' ? currentSibling.sun : currentSibling.optical)
    : null;

  return (
    <div className="space-y-4">
      {/* Type toggle (optical/sun) */}
      {hasBothTypes && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Type</span>
          <div className="flex border border-gray-200 rounded-full overflow-hidden">
            <TypeButton
              label="Optical"
              active={currentType === 'optical'}
              href={currentType === 'optical' ? undefined : (currentSibling?.optical ? `/products/${currentSibling.optical.handle}` : undefined)}
            />
            <TypeButton
              label="Sun"
              active={currentType === 'sun'}
              href={currentType === 'sun' ? undefined : (alternateType ? `/products/${alternateType.handle}` : undefined)}
            />
          </div>
        </div>
      )}

      {/* Colour swatches */}
      <div>
        <span className="text-xs text-gray-500 block mb-2">
          Colour — {currentSibling?.colour?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? ''}
        </span>
        <div className="flex flex-wrap gap-2">
          {data.siblings.map(s => {
            const product = currentType === 'sun' ? (s.sun ?? s.optical) : (s.optical ?? s.sun);
            if (!product) return null;
            const numCurrentId = productId.replace(/^gid:\/\/shopify\/Product\//, '');
            const isActive = product.productId === numCurrentId;

            return (
              <Link
                key={s.colour}
                href={`/products/${product.handle}`}
                className={`relative w-8 h-8 rounded-full border-2 transition-all ${
                  isActive ? 'border-black scale-110' : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ background: s.hex || '#ccc' }}
                title={s.colour.replace(/-/g, ' ')}
                aria-label={`Switch to ${s.colour.replace(/-/g, ' ')}`}
                aria-current={isActive ? 'true' : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TypeButton({ label, active, href }: { label: string; active: boolean; href?: string }) {
  const className = `px-4 py-1.5 text-xs font-medium transition-colors ${
    active ? 'bg-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
  }`;

  if (!href || active) {
    return <span className={className}>{label}</span>;
  }
  return <Link href={href} className={className}>{label}</Link>;
}
