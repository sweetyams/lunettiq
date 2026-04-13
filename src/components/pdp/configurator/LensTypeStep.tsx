'use client';

import type { LensType } from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';

interface LensTypeOption {
  value: LensType;
  label: string;
  description: string;
  sunOnly?: boolean;
}

const LENS_TYPE_OPTIONS: LensTypeOption[] = [
  {
    value: 'singleVision',
    label: 'Single Vision',
    description: 'One prescription power across the entire lens — for distance or reading.',
  },
  {
    value: 'progressive',
    label: 'Progressive',
    description: 'Seamless transition from distance to near vision — no visible line.',
  },
  {
    value: 'nonPrescription',
    label: 'Non-Prescription',
    description: 'Clear plano lenses with no vision correction.',
  },
  {
    value: 'readers',
    label: 'Readers',
    description: 'Magnification lenses for close-up reading.',
  },
  {
    value: 'prescriptionSun',
    label: 'Prescription Sun',
    description: 'Prescription lenses with sun tint and UV protection.',
    sunOnly: true,
  },
  {
    value: 'nonPrescriptionSun',
    label: 'Non-Prescription Sun',
    description: 'Tinted sun lenses with no vision correction.',
    sunOnly: true,
  },
];

interface LensTypeStepProps {
  selected: LensType | null;
  isSunglasses: boolean;
  lensOptions: LensOption[];
  onSelect: (type: LensType) => void;
}

export default function LensTypeStep({
  selected,
  isSunglasses,
  lensOptions,
  onSelect,
}: LensTypeStepProps) {
  // Filter: show sun-only options only for sunglasses products
  const visibleOptions = LENS_TYPE_OPTIONS.filter(
    (opt) => !opt.sunOnly || isSunglasses
  );

  // Determine which types are available based on lensOptions metaobjects
  function isAvailable(type: LensType): { available: boolean; reason?: string } {
    // Check if any lens option is compatible with this type
    const hasCompatible = lensOptions.some(
      (lo) =>
        lo.active &&
        (lo.compatibleLensTypes.length === 0 ||
          lo.compatibleLensTypes.includes(type))
    );
    if (!hasCompatible && lensOptions.length > 0) {
      return { available: false, reason: 'Not available for this frame' };
    }
    return { available: true };
  }

  return (
    <div>
      <h4 className="text-sm font-medium mb-3">Select Lens Type</h4>
      <div className="space-y-2">
        {visibleOptions.map((opt) => {
          const { available, reason } = isAvailable(opt.value);
          const isSelected = selected === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              disabled={!available}
              onClick={() => onSelect(opt.value)}
              className={`
                w-full text-left p-3 rounded-lg border transition-colors
                ${isSelected ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}
                ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-pressed={isSelected}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{opt.label}</span>
                {isSelected && (
                  <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
              {!available && reason && (
                <p className="text-xs text-red-500 mt-1">{reason}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
