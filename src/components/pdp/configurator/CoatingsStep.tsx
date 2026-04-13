'use client';

import type {
  LensCoating,
  LensType,
  SunLensOptions,
  TintColour,
  MirrorCoating,
} from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';

/* ------------------------------------------------------------------ */
/*  Mutual exclusivity rules                                           */
/* ------------------------------------------------------------------ */

/** Pairs of coatings that cannot coexist */
const EXCLUSIVE_PAIRS: [LensCoating, LensCoating][] = [
  ['antiReflective', 'antiReflectivePremium'],
];

export function getExcludedCoatings(selected: LensCoating[]): Map<LensCoating, string> {
  const excluded = new Map<LensCoating, string>();
  for (const [a, b] of EXCLUSIVE_PAIRS) {
    if (selected.includes(a)) {
      excluded.set(b, `Cannot combine with ${COATING_LABELS[a]}`);
    }
    if (selected.includes(b)) {
      excluded.set(a, `Cannot combine with ${COATING_LABELS[b]}`);
    }
  }
  return excluded;
}

/* ------------------------------------------------------------------ */
/*  Coating metadata                                                   */
/* ------------------------------------------------------------------ */

const COATING_LABELS: Record<LensCoating, string> = {
  antiReflective: 'Anti-Reflective',
  antiReflectivePremium: 'Anti-Reflective Premium',
  blueLight: 'Blue Light Filter',
  photochromic: 'Photochromic (Transition)',
  scratchResistant: 'Scratch-Resistant',
  hydrophobic: 'Hydrophobic',
  oleophobic: 'Oleophobic',
};

const COATING_DESCRIPTIONS: Record<LensCoating, string> = {
  antiReflective: 'Reduces glare from screens and artificial lighting.',
  antiReflectivePremium: 'Premium multi-layer AR coating for maximum clarity.',
  blueLight: 'Filters harmful blue light from digital screens.',
  photochromic: 'Lenses darken in sunlight and clear indoors.',
  scratchResistant: 'Durable coating to protect against everyday scratches.',
  hydrophobic: 'Repels water for clear vision in wet conditions.',
  oleophobic: 'Resists fingerprints and smudges.',
};

const ALL_COATINGS: LensCoating[] = [
  'antiReflective',
  'antiReflectivePremium',
  'blueLight',
  'photochromic',
  'scratchResistant',
  'hydrophobic',
  'oleophobic',
];

/* ------------------------------------------------------------------ */
/*  Tint / Mirror metadata                                             */
/* ------------------------------------------------------------------ */

const TINT_OPTIONS: { value: TintColour; label: string; swatch: string }[] = [
  { value: 'gray', label: 'Gray', swatch: 'bg-gray-500' },
  { value: 'brown', label: 'Brown', swatch: 'bg-amber-700' },
  { value: 'green', label: 'Green', swatch: 'bg-green-700' },
  { value: 'rose', label: 'Rose', swatch: 'bg-rose-400' },
  { value: 'yellow', label: 'Yellow', swatch: 'bg-yellow-400' },
];

const MIRROR_OPTIONS: { value: MirrorCoating; label: string; swatch: string }[] = [
  { value: 'silver', label: 'Silver', swatch: 'bg-gray-300' },
  { value: 'gold', label: 'Gold', swatch: 'bg-yellow-500' },
  { value: 'blue', label: 'Blue', swatch: 'bg-blue-500' },
  { value: 'green', label: 'Green', swatch: 'bg-green-500' },
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CoatingsStepProps {
  selectedCoatings: LensCoating[];
  sunOptions: SunLensOptions | null;
  isSunglasses: boolean;
  lensType: LensType | null;
  lensOptions: LensOption[];
  onCoatingsChange: (coatings: LensCoating[]) => void;
  onSunOptionsChange: (options: SunLensOptions | null) => void;
  onNext: () => void;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getCoatingPrice(coating: LensCoating, lensOptions: LensOption[]): number {
  const match = lensOptions.find(
    (lo) => lo.type === 'coating' && lo.active && lo.name.toLowerCase().includes(coating.toLowerCase())
  );
  return match?.price ?? 0;
}

function getPolarizationPrice(lensOptions: LensOption[]): number {
  const match = lensOptions.find(
    (lo) => lo.active && lo.name.toLowerCase().includes('polariz')
  );
  return match?.price ?? 0;
}

function getMirrorPrice(mirror: MirrorCoating, lensOptions: LensOption[]): number {
  const match = lensOptions.find(
    (lo) => lo.type === 'mirror' && lo.active && lo.name.toLowerCase().includes(mirror.toLowerCase())
  );
  return match?.price ?? 0;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CoatingsStep({
  selectedCoatings,
  sunOptions,
  isSunglasses,
  lensType,
  lensOptions,
  onCoatingsChange,
  onSunOptionsChange,
  onNext,
  onBack,
}: CoatingsStepProps) {
  const excluded = getExcludedCoatings(selectedCoatings);
  const showSunOptions =
    isSunglasses ||
    lensType === 'prescriptionSun' ||
    lensType === 'nonPrescriptionSun';

  function toggleCoating(coating: LensCoating) {
    if (selectedCoatings.includes(coating)) {
      onCoatingsChange(selectedCoatings.filter((c) => c !== coating));
    } else {
      onCoatingsChange([...selectedCoatings, coating]);
    }
  }

  // Initialize sun options with defaults if needed
  function ensureSunOptions(): SunLensOptions {
    return sunOptions ?? { tintColour: 'gray', polarized: false, mirrorCoating: null };
  }

  function setTint(tint: TintColour) {
    onSunOptionsChange({ ...ensureSunOptions(), tintColour: tint });
  }

  function togglePolarization() {
    const current = ensureSunOptions();
    onSunOptionsChange({ ...current, polarized: !current.polarized });
  }

  function setMirror(mirror: MirrorCoating | null) {
    onSunOptionsChange({ ...ensureSunOptions(), mirrorCoating: mirror });
  }

  return (
    <div>
      {/* Standard coatings */}
      <h4 className="text-sm font-medium mb-3">Coatings &amp; Add-Ons</h4>
      <p className="text-xs text-green-600 mb-3">✓ UV Protection included on all lenses</p>

      <div className="space-y-2 mb-6">
        {ALL_COATINGS.map((coating) => {
          const isSelected = selectedCoatings.includes(coating);
          const exclusion = excluded.get(coating);
          const disabled = !!exclusion && !isSelected;
          const price = getCoatingPrice(coating, lensOptions);

          return (
            <button
              key={coating}
              type="button"
              disabled={disabled}
              onClick={() => toggleCoating(coating)}
              className={`
                w-full text-left p-3 rounded-lg border transition-colors
                ${isSelected ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-pressed={isSelected}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center text-xs
                      ${isSelected ? 'bg-black border-black text-white' : 'border-gray-300'}
                    `}
                  >
                    {isSelected && '✓'}
                  </span>
                  <span className="text-sm font-medium">{COATING_LABELS[coating]}</span>
                </div>
                <span className="text-sm text-gray-600">
                  {price === 0 ? 'Free' : `+$${price.toFixed(2)}`}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                {COATING_DESCRIPTIONS[coating]}
              </p>
              {disabled && exclusion && (
                <p className="text-xs text-red-500 mt-1 ml-6">{exclusion}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Sunglasses options */}
      {showSunOptions && (
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium mb-3">Sunglasses Options</h4>

          {/* Tint colour */}
          <div className="mb-4">
            <p className="text-xs text-gray-600 mb-2">Tint Colour</p>
            <div className="flex gap-2">
              {TINT_OPTIONS.map((tint) => {
                const isSelected = (sunOptions?.tintColour ?? 'gray') === tint.value;
                return (
                  <button
                    key={tint.value}
                    type="button"
                    onClick={() => setTint(tint.value)}
                    className={`
                      flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors
                      ${isSelected ? 'border-black' : 'border-gray-200 hover:border-gray-400'}
                    `}
                    aria-pressed={isSelected}
                    title={tint.label}
                  >
                    <span className={`w-6 h-6 rounded-full ${tint.swatch}`} />
                    <span className="text-[10px] text-gray-600">{tint.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Polarization */}
          <div className="mb-4">
            <button
              type="button"
              onClick={togglePolarization}
              className={`
                w-full text-left p-3 rounded-lg border transition-colors
                ${sunOptions?.polarized ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}
              `}
              aria-pressed={sunOptions?.polarized ?? false}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center text-xs
                      ${sunOptions?.polarized ? 'bg-black border-black text-white' : 'border-gray-300'}
                    `}
                  >
                    {sunOptions?.polarized && '✓'}
                  </span>
                  <span className="text-sm font-medium">Polarization</span>
                </div>
                <span className="text-sm text-gray-600">
                  +${getPolarizationPrice(lensOptions).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Reduces glare from reflective surfaces for clearer vision.
              </p>
            </button>
          </div>

          {/* Mirror coating */}
          <div className="mb-4">
            <p className="text-xs text-gray-600 mb-2">Mirror Coating (optional)</p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setMirror(null)}
                className={`
                  px-3 py-1.5 rounded-lg border text-xs transition-colors
                  ${sunOptions?.mirrorCoating === null || !sunOptions ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}
                `}
              >
                None
              </button>
              {MIRROR_OPTIONS.map((mirror) => {
                const isSelected = sunOptions?.mirrorCoating === mirror.value;
                const price = getMirrorPrice(mirror.value, lensOptions);
                return (
                  <button
                    key={mirror.value}
                    type="button"
                    onClick={() => setMirror(mirror.value)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-colors
                      ${isSelected ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}
                    `}
                    aria-pressed={isSelected}
                  >
                    <span className={`w-4 h-4 rounded-full ${mirror.swatch}`} />
                    <span>{mirror.label}</span>
                    {price > 0 && <span className="text-gray-500">+${price.toFixed(2)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-black transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
