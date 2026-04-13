import { describe, it, expect } from 'vitest';
import {
  configuratorReducer,
  initialState,
  requiresPrescription,
  isReaders,
  stepsForType,
} from './LensConfigurator';
import type { ConfiguratorState } from './LensConfigurator';

describe('requiresPrescription', () => {
  it('returns true for singleVision', () => {
    expect(requiresPrescription('singleVision')).toBe(true);
  });
  it('returns true for progressive', () => {
    expect(requiresPrescription('progressive')).toBe(true);
  });
  it('returns true for prescriptionSun', () => {
    expect(requiresPrescription('prescriptionSun')).toBe(true);
  });
  it('returns false for nonPrescription', () => {
    expect(requiresPrescription('nonPrescription')).toBe(false);
  });
  it('returns false for readers', () => {
    expect(requiresPrescription('readers')).toBe(false);
  });
  it('returns false for null', () => {
    expect(requiresPrescription(null)).toBe(false);
  });
});

describe('isReaders', () => {
  it('returns true for readers', () => {
    expect(isReaders('readers')).toBe(true);
  });
  it('returns false for singleVision', () => {
    expect(isReaders('singleVision')).toBe(false);
  });
});

describe('stepsForType', () => {
  it('includes prescription step for singleVision', () => {
    expect(stepsForType('singleVision')).toContain('prescription');
  });
  it('skips prescription for nonPrescription', () => {
    expect(stepsForType('nonPrescription')).not.toContain('prescription');
  });
  it('includes prescription for readers (magnification)', () => {
    expect(stepsForType('readers')).toContain('prescription');
  });
  it('always starts with lensType and ends with summary', () => {
    const steps = stepsForType('progressive');
    expect(steps[0]).toBe('lensType');
    expect(steps[steps.length - 1]).toBe('summary');
  });
});

describe('configuratorReducer', () => {
  it('sets lens type and advances to lensIndex', () => {
    const next = configuratorReducer(initialState, {
      type: 'SET_LENS_TYPE',
      payload: 'singleVision',
    });
    expect(next.config.lensType).toBe('singleVision');
    expect(next.currentStep).toBe('lensIndex');
  });

  it('clears prescription when switching from Rx to non-Rx type', () => {
    const withRx: ConfiguratorState = {
      ...initialState,
      config: {
        ...initialState.config,
        lensType: 'singleVision',
        prescription: { od: { sphere: -2, cylinder: 0, axis: 0 }, os: { sphere: -2, cylinder: 0, axis: 0 }, pd: 63 },
        prescriptionMethod: 'manual',
      },
    };
    const next = configuratorReducer(withRx, {
      type: 'SET_LENS_TYPE',
      payload: 'nonPrescription',
    });
    expect(next.config.prescription).toBeNull();
    expect(next.config.prescriptionMethod).toBeNull();
  });

  it('preserves prescription when switching between Rx types', () => {
    const withRx: ConfiguratorState = {
      ...initialState,
      config: {
        ...initialState.config,
        lensType: 'singleVision',
        prescription: { od: { sphere: -2, cylinder: 0, axis: 0 }, os: { sphere: -2, cylinder: 0, axis: 0 }, pd: 63 },
        prescriptionMethod: 'manual',
      },
    };
    const next = configuratorReducer(withRx, {
      type: 'SET_LENS_TYPE',
      payload: 'progressive',
    });
    expect(next.config.prescription).not.toBeNull();
    expect(next.config.prescriptionMethod).toBe('manual');
  });

  it('changing lensIndex does NOT affect coatings', () => {
    const withCoatings: ConfiguratorState = {
      ...initialState,
      config: {
        ...initialState.config,
        lensType: 'singleVision',
        lensIndex: '1.50',
        coatings: ['antiReflective', 'blueLight'],
      },
    };
    const next = configuratorReducer(withCoatings, {
      type: 'SET_LENS_INDEX',
      payload: '1.67',
    });
    expect(next.config.lensIndex).toBe('1.67');
    expect(next.config.coatings).toEqual(['antiReflective', 'blueLight']);
  });

  it('NEXT_STEP advances correctly', () => {
    const state: ConfiguratorState = {
      ...initialState,
      config: { ...initialState.config, lensType: 'nonPrescription' },
      currentStep: 'coatings',
    };
    const next = configuratorReducer(state, { type: 'NEXT_STEP' });
    // nonPrescription: coatings → summary (skips prescription)
    expect(next.currentStep).toBe('summary');
  });

  it('PREV_STEP goes back correctly', () => {
    const state: ConfiguratorState = {
      ...initialState,
      config: { ...initialState.config, lensType: 'singleVision' },
      currentStep: 'coatings',
    };
    const next = configuratorReducer(state, { type: 'PREV_STEP' });
    expect(next.currentStep).toBe('lensIndex');
  });

  it('RESET returns to initial state', () => {
    const modified: ConfiguratorState = {
      config: {
        lensType: 'progressive',
        lensIndex: '1.67',
        coatings: ['blueLight'],
        sunOptions: null,
        prescription: null,
        prescriptionMethod: null,
      },
      currentStep: 'coatings',
      readersMagnification: null,
    };
    const next = configuratorReducer(modified, { type: 'RESET' });
    expect(next).toEqual(initialState);
  });

  it('GO_TO_STEP navigates to specified step', () => {
    const next = configuratorReducer(initialState, {
      type: 'GO_TO_STEP',
      payload: 'summary',
    });
    expect(next.currentStep).toBe('summary');
  });

  it('clears readers magnification when switching away from readers', () => {
    const state: ConfiguratorState = {
      ...initialState,
      config: { ...initialState.config, lensType: 'readers' },
      readersMagnification: 2.0,
    };
    const next = configuratorReducer(state, {
      type: 'SET_LENS_TYPE',
      payload: 'singleVision',
    });
    expect(next.readersMagnification).toBeNull();
  });
});
