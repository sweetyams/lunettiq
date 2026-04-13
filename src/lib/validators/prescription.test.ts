import { describe, it, expect } from 'vitest';
import {
  validateSphere,
  validateCylinder,
  validateAxis,
  validatePD,
  validateAddPower,
  validateCylinderAxis,
  validatePrescription,
} from './prescription';

describe('validateSphere', () => {
  it('accepts 0', () => {
    expect(validateSphere(0).valid).toBe(true);
  });

  it('accepts -20.00', () => {
    expect(validateSphere(-20).valid).toBe(true);
  });

  it('accepts +20.00', () => {
    expect(validateSphere(20).valid).toBe(true);
  });

  it('accepts -3.25 (valid step)', () => {
    expect(validateSphere(-3.25).valid).toBe(true);
  });

  it('rejects -20.25 (out of range)', () => {
    const r = validateSphere(-20.25);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('-20.00');
  });

  it('rejects 20.50 (out of range)', () => {
    expect(validateSphere(20.5).valid).toBe(false);
  });

  it('rejects -3.10 (invalid step)', () => {
    const r = validateSphere(-3.1);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('0.25');
  });
});

describe('validateCylinder', () => {
  it('accepts 0', () => {
    expect(validateCylinder(0).valid).toBe(true);
  });

  it('accepts -6.00', () => {
    expect(validateCylinder(-6).valid).toBe(true);
  });

  it('rejects -6.25', () => {
    expect(validateCylinder(-6.25).valid).toBe(false);
  });

  it('rejects 0.10 (invalid step)', () => {
    expect(validateCylinder(0.1).valid).toBe(false);
  });
});

describe('validateAxis', () => {
  it('accepts 1', () => {
    expect(validateAxis(1).valid).toBe(true);
  });

  it('accepts 180', () => {
    expect(validateAxis(180).valid).toBe(true);
  });

  it('rejects 0', () => {
    expect(validateAxis(0).valid).toBe(false);
  });

  it('rejects 181', () => {
    expect(validateAxis(181).valid).toBe(false);
  });

  it('rejects 90.5 (not integer)', () => {
    expect(validateAxis(90.5).valid).toBe(false);
  });
});

describe('validatePD', () => {
  it('accepts 63', () => {
    expect(validatePD(63).valid).toBe(true);
  });

  it('accepts 50', () => {
    expect(validatePD(50).valid).toBe(true);
  });

  it('accepts 80', () => {
    expect(validatePD(80).valid).toBe(true);
  });

  it('accepts 63.5 (valid step)', () => {
    expect(validatePD(63.5).valid).toBe(true);
  });

  it('rejects 49.5', () => {
    expect(validatePD(49.5).valid).toBe(false);
  });

  it('rejects 63.3 (invalid step)', () => {
    expect(validatePD(63.3).valid).toBe(false);
  });
});

describe('validateAddPower', () => {
  it('accepts 1.50', () => {
    expect(validateAddPower(1.5).valid).toBe(true);
  });

  it('rejects 0.25 (below range)', () => {
    expect(validateAddPower(0.25).valid).toBe(false);
  });

  it('rejects 4.00 (above range)', () => {
    expect(validateAddPower(4.0).valid).toBe(false);
  });
});

describe('validateCylinderAxis', () => {
  it('accepts cylinder=0 with no axis', () => {
    expect(validateCylinderAxis(0, null).valid).toBe(true);
  });

  it('rejects cylinder=-1.50 with no axis', () => {
    const r = validateCylinderAxis(-1.5, null);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Axis is required');
  });

  it('accepts cylinder=-1.50 with axis=90', () => {
    expect(validateCylinderAxis(-1.5, 90).valid).toBe(true);
  });
});

describe('validatePrescription', () => {
  it('accepts a valid complete prescription', () => {
    const results = validatePrescription(
      { sphere: -2.5, cylinder: -1.25, axis: 90 },
      { sphere: -3.0, cylinder: -0.75, axis: 180 },
      63
    );
    expect(results.every((r) => r.valid)).toBe(true);
  });

  it('returns errors for invalid sphere', () => {
    const results = validatePrescription(
      { sphere: -25, cylinder: 0, axis: 0 },
      { sphere: 0, cylinder: 0, axis: 0 },
      63
    );
    expect(results.some((r) => !r.valid)).toBe(true);
  });
});
