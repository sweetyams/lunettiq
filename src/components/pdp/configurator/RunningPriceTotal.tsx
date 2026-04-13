'use client';

import { useMemo } from 'react';
import type { LensConfiguration, LensIndex, LensCoating, MirrorCoating } from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';
import { matchIndex } from './LensIndexStep';

/* ------------------------------------------------------------------ */
/*  Price calculation helpers (exported for reuse in ConfigSummary)     */
/* ------------------------------------------------------------------ */

export function getLensIndexPrice(index: LensIndex | null, lensOptions: LensOption[]): number {
  if (!index) return 0;
  const match = lensOptions.find(
    (lo) => lo.type === 'lensIndex' && lo.active && matchIndex(lo.name) === index
  );
  return match?.price ?? 0;
}

export function getCoatingPrice(coating: LensCoating, lensOptions: LensOption[]): number {
  const lower = coating.toLowerCase();
  const match = lensOptions.find(
    (lo) => lo.type === 'coating' && lo.active && lo.name.toLowerCase().includes(lower)
  );
  return match?.price ?? 0;
}

export function getPolarizationPrice(lensOptions: LensOption[]): number {
  const match = lensOptions.find(
    (lo) => lo.active && lo.name.toLowerCase().includes('polariz')
  );
  return match?.price ?? 0;
}

export function getMirrorPrice(mirror: MirrorCoating | null, lensOptions: LensOption[]): number {
  if (!mirror) return 0;
  const match = lensOptions.find(
    (lo) => lo.type === 'mirror' && lo.active && lo.name.toLowerCase().includes(mirror.toLowerCase())
  );
  return match?.price ?? 0;
}

export function calculateTotal(
  config: LensConfiguration,
  lensOptions: LensOption[],
  frameBasePrice: number
): number {
  let total = frameBasePrice;
  total += getLensIndexPrice(config.lensIndex, lensOptions);
  for (const coating of config.coatings) {
    total += getCoatingPrice(coating, lensOptions);
  }
  if (config.sunOptions?.polarized) {
    total += getPolarizationPrice(lensOptions);
  }
  total += getMirrorPrice(config.sunOptions?.mirrorCoating ?? null, lensOptions);
  return total;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface RunningPriceTotalProps {
  config: LensConfiguration;
  lensOptions: LensOption[];
  frameBasePrice: number;
}

export default function RunningPriceTotal({
  config,
  lensOptions,
  frameBasePrice,
}: RunningPriceTotalProps) {
  const total = useMemo(
    () => calculateTotal(config, lensOptions, frameBasePrice),
    [config, lensOptions, frameBasePrice]
  );

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded text-sm">
      <span className="text-gray-600">Running Total</span>
      <span className="font-semibold">${total.toFixed(2)}</span>
    </div>
  );
}
