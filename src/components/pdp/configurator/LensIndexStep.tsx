'use client';

import type { LensIndex, LensType } from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';

interface IndexOption {
  value: LensIndex;
  label: string;
  fallbackDescription: string;
}

const INDEX_OPTIONS: IndexOption[] = [
  { value: '1.50', label: 'Standard (1.50)', fallbackDescription: 'Included — suitable for mild prescriptions.' },
  { value: '1.61', label: 'Thin (1.61)', fallbackDescription: 'Thinner and lighter than standard.' },
  { value: '1.67', label: 'Ultra-Thin (1.67)', fallbackDescription: 'Recommended for prescriptions above ±4.00.' },
  { value: '1.74', label: 'Thinnest (1.74)', fallbackDescription: 'The thinnest option — ideal for strong prescriptions.' },
  { value: 'polycarbonate', label: 'Polycarbonate', fallbackDescription: 'Impact-resistant — great for active lifestyles.' },
];

interface LensIndexStepProps {
  selected: LensIndex | null;
  lensType: LensType | null;
  lensOptions: LensOption[];
  onSelect: (index: LensIndex) => void;
  onBack: () => void;
}

/** Map a LensOption name to a LensIndex value */
function matchIndex(name: string): LensIndex | null {
  const lower = name.toLowerCase();
  if (lower.includes('1.74') || lower.includes('thinnest')) return '1.74';
  if (lower.includes('1.67') || lower.includes('ultra')) return '1.67';
  if (lower.includes('1.61') || lower.includes('thin')) return '1.61';
  if (lower.includes('1.50') || lower.includes('standard')) return '1.50';
  if (lower.includes('polycarb')) return 'polycarbonate';
  return null;
}

export default function LensIndexStep({
  selected,
  lensType,
  lensOptions,
  onSelect,
  onBack,
}: LensIndexStepProps) {
  // Build price map from metaobject lens options
  const indexPriceMap = new Map<LensIndex, { price: number; description: string }>();
  lensOptions
    .filter((lo) => lo.type === 'lensIndex' && lo.active)
    .forEach((lo) => {
      const idx = matchIndex(lo.name);
      if (idx) {
        indexPriceMap.set(idx, { price: lo.price, description: lo.description });
      }
    });

  function isCompatible(index: LensIndex): { compatible: boolean; reason?: string } {
    if (!lensType) return { compatible: true };
    // Check metaobject compatibility
    const option = lensOptions.find(
      (lo) => lo.type === 'lensIndex' && lo.active && matchIndex(lo.name) === index
    );
    if (option && option.compatibleLensTypes.length > 0 && !option.compatibleLensTypes.includes(lensType)) {
      return { compatible: false, reason: `Not available with ${lensType} lenses` };
    }
    return { compatible: true };
  }

  return (
    <div>
      <h4 className="text-sm font-medium mb-3">Select Lens Material</h4>
      <div className="space-y-2">
        {INDEX_OPTIONS.map((opt) => {
          const { compatible, reason } = isCompatible(opt.value);
          const isSelected = selected === opt.value;
          const meta = indexPriceMap.get(opt.value);
          const price = meta?.price ?? 0;
          const description = meta?.description || opt.fallbackDescription;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={!compatible}
              onClick={() => onSelect(opt.value)}
              className={`
                w-full text-left p-3 rounded-lg border transition-colors
                ${isSelected ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}
                ${!compatible ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-pressed={isSelected}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-sm text-gray-600">
                  {price === 0 ? 'Included' : `+$${price.toFixed(2)}`}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{description}</p>
              {!compatible && reason && (
                <p className="text-xs text-red-500 mt-1">{reason}</p>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-sm text-gray-500 hover:text-black transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}

export { matchIndex };
