'use client';

import type { LensConfiguration, ConfiguratorStep, LensCoating } from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';
import {
  calculateTotal,
  getLensIndexPrice,
  getCoatingPrice,
  getPolarizationPrice,
  getMirrorPrice,
} from './RunningPriceTotal';

/* ------------------------------------------------------------------ */
/*  Label maps                                                         */
/* ------------------------------------------------------------------ */

const LENS_TYPE_LABELS: Record<string, string> = {
  singleVision: 'Single Vision',
  progressive: 'Progressive',
  nonPrescription: 'Non-Prescription',
  readers: 'Readers',
  prescriptionSun: 'Prescription Sun',
  nonPrescriptionSun: 'Non-Prescription Sun',
};

const LENS_INDEX_LABELS: Record<string, string> = {
  '1.50': 'Standard (1.50)',
  '1.61': 'Thin (1.61)',
  '1.67': 'Ultra-Thin (1.67)',
  '1.74': 'Thinnest (1.74)',
  polycarbonate: 'Polycarbonate',
};

const COATING_LABELS: Record<LensCoating, string> = {
  antiReflective: 'Anti-Reflective',
  antiReflectivePremium: 'Anti-Reflective Premium',
  blueLight: 'Blue Light Filter',
  photochromic: 'Photochromic',
  scratchResistant: 'Scratch-Resistant',
  hydrophobic: 'Hydrophobic',
  oleophobic: 'Oleophobic',
};

const RX_METHOD_LABELS: Record<string, string> = {
  manual: 'Entered manually',
  upload: 'Uploaded image',
  sendLater: 'Will send later',
  saved: 'From saved Rx',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ConfigSummaryProps {
  config: LensConfiguration;
  lensOptions: LensOption[];
  frameBasePrice: number;
  frameName: string;
  frameColour: string | null;
  readersMagnification: number | null;
  onEdit: (step: ConfiguratorStep) => void;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ConfigSummary({
  config,
  lensOptions,
  frameBasePrice,
  frameName,
  frameColour,
  readersMagnification,
  onEdit,
  onBack,
}: ConfigSummaryProps) {
  const total = calculateTotal(config, lensOptions, frameBasePrice);
  const indexPrice = getLensIndexPrice(config.lensIndex, lensOptions);
  const polarizationPrice = config.sunOptions?.polarized ? getPolarizationPrice(lensOptions) : 0;
  const mirrorPrice = getMirrorPrice(config.sunOptions?.mirrorCoating ?? null, lensOptions);

  return (
    <div>
      <h4 className="text-sm font-medium mb-4">Configuration Summary</h4>

      <div className="space-y-4">
        {/* Frame */}
        <SummaryRow label="Frame" onEdit={() => onEdit('lensType')}>
          <p className="text-sm">{frameName}</p>
          {frameColour && <p className="text-xs text-gray-500">{frameColour}</p>}
          <p className="text-xs text-gray-500">${frameBasePrice.toFixed(2)}</p>
        </SummaryRow>

        {/* Lens Type */}
        <SummaryRow label="Lens Type" onEdit={() => onEdit('lensType')}>
          <p className="text-sm">
            {config.lensType ? LENS_TYPE_LABELS[config.lensType] ?? config.lensType : '—'}
          </p>
          {config.lensType === 'readers' && readersMagnification && (
            <p className="text-xs text-gray-500">+{readersMagnification.toFixed(2)} magnification</p>
          )}
        </SummaryRow>

        {/* Material */}
        <SummaryRow label="Lens Material" onEdit={() => onEdit('lensIndex')}>
          <div className="flex items-center justify-between">
            <p className="text-sm">
              {config.lensIndex ? LENS_INDEX_LABELS[config.lensIndex] ?? config.lensIndex : '—'}
            </p>
            {indexPrice > 0 && (
              <span className="text-xs text-gray-500">+${indexPrice.toFixed(2)}</span>
            )}
          </div>
        </SummaryRow>

        {/* Coatings */}
        <SummaryRow label="Coatings" onEdit={() => onEdit('coatings')}>
          {config.coatings.length === 0 && <p className="text-sm text-gray-400">None selected</p>}
          {config.coatings.map((c) => {
            const price = getCoatingPrice(c, lensOptions);
            return (
              <div key={c} className="flex items-center justify-between">
                <p className="text-sm">{COATING_LABELS[c]}</p>
                {price > 0 && <span className="text-xs text-gray-500">+${price.toFixed(2)}</span>}
              </div>
            );
          })}
        </SummaryRow>

        {/* Sunglasses options */}
        {config.sunOptions && (
          <SummaryRow label="Sun Options" onEdit={() => onEdit('coatings')}>
            <p className="text-sm capitalize">Tint: {config.sunOptions.tintColour}</p>
            {config.sunOptions.polarized && (
              <div className="flex items-center justify-between">
                <p className="text-sm">Polarized</p>
                {polarizationPrice > 0 && (
                  <span className="text-xs text-gray-500">+${polarizationPrice.toFixed(2)}</span>
                )}
              </div>
            )}
            {config.sunOptions.mirrorCoating && (
              <div className="flex items-center justify-between">
                <p className="text-sm capitalize">Mirror: {config.sunOptions.mirrorCoating}</p>
                {mirrorPrice > 0 && (
                  <span className="text-xs text-gray-500">+${mirrorPrice.toFixed(2)}</span>
                )}
              </div>
            )}
          </SummaryRow>
        )}

        {/* Prescription */}
        <SummaryRow label="Prescription" onEdit={() => onEdit('prescription')}>
          <p className="text-sm">
            {config.prescriptionMethod
              ? RX_METHOD_LABELS[config.prescriptionMethod] ?? config.prescriptionMethod
              : 'Not applicable'}
          </p>
          {config.prescriptionMethod === 'sendLater' && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠ Remember to email your prescription after checkout
            </p>
          )}
        </SummaryRow>

        {/* Price breakdown */}
        <div className="border-t border-gray-200 pt-4">
          <h5 className="text-xs font-medium text-gray-500 mb-2">Price Breakdown</h5>
          <div className="space-y-1 text-sm">
            <PriceLine label="Frame" amount={frameBasePrice} />
            {indexPrice > 0 && (
              <PriceLine
                label={`Lens Material (${config.lensIndex ? LENS_INDEX_LABELS[config.lensIndex] : ''})`}
                amount={indexPrice}
              />
            )}
            {config.coatings.map((c) => {
              const price = getCoatingPrice(c, lensOptions);
              return price > 0 ? <PriceLine key={c} label={COATING_LABELS[c]} amount={price} /> : null;
            })}
            {polarizationPrice > 0 && <PriceLine label="Polarization" amount={polarizationPrice} />}
            {mirrorPrice > 0 && (
              <PriceLine label={`Mirror (${config.sunOptions?.mirrorCoating})`} amount={mirrorPrice} />
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 font-semibold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-black transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SummaryRow({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-blue-600 hover:underline"
        >
          Edit
        </button>
      </div>
      <div>{children}</div>
    </div>
  );
}

function PriceLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span>${amount.toFixed(2)}</span>
    </div>
  );
}
