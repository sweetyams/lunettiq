'use client';

import Image from 'next/image';
import type { ProductVariant } from '@/types/shopify';

interface ColourSelectorProps {
  colours: string[];
  variants: ProductVariant[];
  selectedColour: string | null;
  onColourChange: (colour: string) => void;
}

export default function ColourSelector({
  colours,
  variants,
  selectedColour,
  onColourChange,
}: ColourSelectorProps) {
  // Get a representative variant image for each colour
  const colourImages = colours.map((colour) => {
    const variant = variants.find((v) =>
      v.selectedOptions.some(
        (opt) =>
          (opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour') &&
          opt.value.toLowerCase() === colour.toLowerCase()
      )
    );
    return {
      colour,
      image: variant?.image ?? null,
    };
  });

  return (
    <div>
      {/* Colour name label */}
      <p className="text-sm text-gray-600 mb-3">
        Colour: <span className="text-black font-medium">{selectedColour ?? ''}</span>
      </p>

      {/* Colour thumbnails */}
      <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour options">
        {colourImages.map(({ colour, image }) => {
          const isSelected = selectedColour?.toLowerCase() === colour.toLowerCase();
          return (
            <button
              key={colour}
              onClick={() => onColourChange(colour)}
              className={`relative overflow-hidden transition-all ${
                isSelected
                  ? 'ring-2 ring-black ring-offset-2'
                  : 'ring-1 ring-gray-200 hover:ring-gray-400'
              }`}
              style={{ width: 64, height: 80 }}
              role="radio"
              aria-checked={isSelected}
              aria-label={colour}
            >
              {image ? (
                <Image
                  src={image.url}
                  alt={colour}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : (
                <div className="w-full h-full bg-[#F5F5F9] flex items-center justify-center">
                  <span className="text-[10px] text-gray-400 text-center px-1">{colour}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
