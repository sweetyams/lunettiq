import { describe, it, expect } from 'vitest';
import { calculateTotal } from './RunningPriceTotal';
import type { LensConfiguration } from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';

const mockLensOptions: LensOption[] = [
  { type: 'lensIndex', name: 'Standard 1.50', description: '', price: 0, sortOrder: 1, compatibleLensTypes: [], active: true },
  { type: 'lensIndex', name: 'Thin 1.61', description: '', price: 30, sortOrder: 2, compatibleLensTypes: [], active: true },
  { type: 'lensIndex', name: 'Ultra-Thin 1.67', description: '', price: 60, sortOrder: 3, compatibleLensTypes: [], active: true },
  { type: 'coating', name: 'antiReflective', description: '', price: 25, sortOrder: 1, compatibleLensTypes: [], active: true },
  { type: 'coating', name: 'blueLight', description: '', price: 35, sortOrder: 2, compatibleLensTypes: [], active: true },
  { type: 'coating', name: 'Polarization', description: '', price: 50, sortOrder: 1, compatibleLensTypes: [], active: true },
  { type: 'mirror', name: 'Silver mirror', description: '', price: 40, sortOrder: 1, compatibleLensTypes: [], active: true },
];

describe('calculateTotal', () => {
  it('returns frame price when no options selected', () => {
    const config: LensConfiguration = {
      lensType: null,
      lensIndex: null,
      coatings: [],
      sunOptions: null,
      prescription: null,
      prescriptionMethod: null,
    };
    expect(calculateTotal(config, mockLensOptions, 200)).toBe(200);
  });

  it('adds lens index price', () => {
    const config: LensConfiguration = {
      lensType: 'singleVision',
      lensIndex: '1.61',
      coatings: [],
      sunOptions: null,
      prescription: null,
      prescriptionMethod: null,
    };
    expect(calculateTotal(config, mockLensOptions, 200)).toBe(230);
  });

  it('adds coating prices', () => {
    const config: LensConfiguration = {
      lensType: 'singleVision',
      lensIndex: '1.50',
      coatings: ['antiReflective', 'blueLight'],
      sunOptions: null,
      prescription: null,
      prescriptionMethod: null,
    };
    expect(calculateTotal(config, mockLensOptions, 200)).toBe(260);
  });

  it('adds polarization and mirror for sunglasses', () => {
    const config: LensConfiguration = {
      lensType: 'prescriptionSun',
      lensIndex: '1.67',
      coatings: [],
      sunOptions: { tintColour: 'gray', polarized: true, mirrorCoating: 'silver' },
      prescription: null,
      prescriptionMethod: null,
    };
    // 200 + 60 (1.67) + 50 (polarization) + 40 (silver mirror) = 350
    expect(calculateTotal(config, mockLensOptions, 200)).toBe(350);
  });

  it('sums everything together', () => {
    const config: LensConfiguration = {
      lensType: 'prescriptionSun',
      lensIndex: '1.61',
      coatings: ['antiReflective'],
      sunOptions: { tintColour: 'brown', polarized: true, mirrorCoating: null },
      prescription: null,
      prescriptionMethod: null,
    };
    // 200 + 30 (1.61) + 25 (AR) + 50 (polarization) = 305
    expect(calculateTotal(config, mockLensOptions, 200)).toBe(305);
  });
});
