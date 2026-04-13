import type { CartLineAttribute } from '@/types/shopify';
import type {
  LensConfiguration,
  LensType,
  LensIndex,
  LensCoating,
  SunLensOptions,
  TintColour,
  MirrorCoating,
} from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';
import {
  getLensIndexPrice,
  getCoatingPrice,
  getPolarizationPrice,
  getMirrorPrice,
  calculateTotal,
} from '@/components/pdp/configurator/RunningPriceTotal';

/**
 * Serialize a complete LensConfiguration into Shopify cart line attributes.
 * Attributes are prefixed with _ to indicate they are custom/internal.
 */
export function serializeConfig(
  config: LensConfiguration,
  lensOptions: LensOption[],
  frameBasePrice: number
): CartLineAttribute[] {
  const attrs: CartLineAttribute[] = [];

  attrs.push({ key: '_lensType', value: config.lensType ?? '' });
  attrs.push({ key: '_lensIndex', value: config.lensIndex ?? '' });
  attrs.push({ key: '_coatings', value: config.coatings.join(',') });

  // Sun options
  attrs.push({ key: '_sunTint', value: config.sunOptions?.tintColour ?? '' });
  attrs.push({ key: '_polarized', value: config.sunOptions?.polarized ? 'true' : 'false' });
  attrs.push({ key: '_mirrorCoating', value: config.sunOptions?.mirrorCoating ?? '' });

  // Prescription
  const rxStatus = config.prescriptionMethod ?? 'none';
  attrs.push({ key: '_rxStatus', value: rxStatus });
  attrs.push({
    key: '_rxData',
    value: config.prescription ? JSON.stringify(config.prescription) : '',
  });

  // Price components
  const lensUpgradePrice = getLensIndexPrice(config.lensIndex, lensOptions);
  let coatingsPrice = 0;
  for (const c of config.coatings) {
    coatingsPrice += getCoatingPrice(c, lensOptions);
  }
  if (config.sunOptions?.polarized) {
    coatingsPrice += getPolarizationPrice(lensOptions);
  }
  coatingsPrice += getMirrorPrice(config.sunOptions?.mirrorCoating ?? null, lensOptions);

  const totalConfigPrice = calculateTotal(config, lensOptions, frameBasePrice);

  attrs.push({ key: '_lensUpgradePrice', value: lensUpgradePrice.toFixed(2) });
  attrs.push({ key: '_coatingsPrice', value: coatingsPrice.toFixed(2) });
  attrs.push({ key: '_totalConfigPrice', value: totalConfigPrice.toFixed(2) });

  return attrs;
}

/**
 * Deserialize cart line attributes back into a partial LensConfiguration.
 */
export function deserializeConfig(
  attributes: CartLineAttribute[]
): Partial<LensConfiguration> {
  const map = new Map(attributes.map((a) => [a.key, a.value]));

  const lensType = (map.get('_lensType') || null) as LensType | null;
  const lensIndex = (map.get('_lensIndex') || null) as LensIndex | null;

  const coatingsStr = map.get('_coatings') ?? '';
  const coatings: LensCoating[] = coatingsStr
    ? (coatingsStr.split(',') as LensCoating[])
    : [];

  // Sun options
  const sunTint = map.get('_sunTint') ?? '';
  const polarized = map.get('_polarized') === 'true';
  const mirrorCoating = map.get('_mirrorCoating') ?? '';

  const sunOptions: SunLensOptions | null = sunTint
    ? {
        tintColour: sunTint as TintColour,
        polarized,
        mirrorCoating: (mirrorCoating || null) as MirrorCoating | null,
      }
    : null;

  // Prescription
  const rxStatus = map.get('_rxStatus') ?? 'none';
  const rxDataStr = map.get('_rxData') ?? '';
  const prescription = rxDataStr ? JSON.parse(rxDataStr) : null;
  const prescriptionMethod =
    rxStatus !== 'none' ? (rxStatus as LensConfiguration['prescriptionMethod']) : null;

  return {
    lensType,
    lensIndex,
    coatings,
    sunOptions,
    prescription,
    prescriptionMethod,
  };
}
