/**
 * Prescription field validators — pure functions.
 * Each returns { valid: boolean; error?: string }.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Check value is a multiple of `step`, accounting for floating-point drift. */
function isStep(value: number, step: number): boolean {
  const remainder = Math.abs(Math.round(value * 100) % Math.round(step * 100));
  return remainder === 0;
}

/** Sphere: [-20, +20] in 0.25 steps */
export function validateSphere(value: number): ValidationResult {
  if (value < -20 || value > 20) {
    return { valid: false, error: 'Sphere must be between -20.00 and +20.00' };
  }
  if (!isStep(value, 0.25)) {
    return { valid: false, error: 'Sphere must be in 0.25 increments' };
  }
  return { valid: true };
}

/** Cylinder: [-6, +6] in 0.25 steps */
export function validateCylinder(value: number): ValidationResult {
  if (value < -6 || value > 6) {
    return { valid: false, error: 'Cylinder must be between -6.00 and +6.00' };
  }
  if (!isStep(value, 0.25)) {
    return { valid: false, error: 'Cylinder must be in 0.25 increments' };
  }
  return { valid: true };
}

/** Axis: integer [1, 180] */
export function validateAxis(value: number): ValidationResult {
  if (!Number.isInteger(value)) {
    return { valid: false, error: 'Axis must be a whole number' };
  }
  if (value < 1 || value > 180) {
    return { valid: false, error: 'Axis must be between 1 and 180' };
  }
  return { valid: true };
}

/** PD: [50, 80] in 0.5 steps */
export function validatePD(value: number): ValidationResult {
  if (value < 50 || value > 80) {
    return { valid: false, error: 'This PD looks unusual. Typical adult PD is between 50 and 80mm. Please double-check.' };
  }
  if (!isStep(value, 0.5)) {
    return { valid: false, error: 'PD must be in 0.5 increments' };
  }
  return { valid: true };
}

/** Add Power (progressive): [+0.50, +3.50] in 0.25 steps */
export function validateAddPower(value: number): ValidationResult {
  if (value < 0.5 || value > 3.5) {
    return { valid: false, error: 'Add Power must be between +0.50 and +3.50' };
  }
  if (!isStep(value, 0.25)) {
    return { valid: false, error: 'Add Power must be in 0.25 increments' };
  }
  return { valid: true };
}

/** Cross-field: cylinder non-zero requires axis */
export function validateCylinderAxis(cylinder: number, axis: number | null | undefined): ValidationResult {
  if (cylinder !== 0 && (axis == null || axis === 0)) {
    return { valid: false, error: 'Axis is required when Cylinder is filled in. Check your prescription for a number between 1 and 180.' };
  }
  return { valid: true };
}

/** Validate a complete eye (OD or OS) */
export function validateEye(
  sphere: number,
  cylinder: number,
  axis: number,
  addPower?: number
): ValidationResult[] {
  const results: ValidationResult[] = [
    validateSphere(sphere),
    validateCylinder(cylinder),
  ];
  if (cylinder !== 0) {
    results.push(validateAxis(axis));
    results.push(validateCylinderAxis(cylinder, axis));
  }
  if (addPower !== undefined) {
    results.push(validateAddPower(addPower));
  }
  return results;
}

/** Validate full prescription data */
export function validatePrescription(
  od: { sphere: number; cylinder: number; axis: number; addPower?: number },
  os: { sphere: number; cylinder: number; axis: number; addPower?: number },
  pd: number
): ValidationResult[] {
  return [
    ...validateEye(od.sphere, od.cylinder, od.axis, od.addPower),
    ...validateEye(os.sphere, os.cylinder, os.axis, os.addPower),
    validatePD(pd),
  ];
}

/** Dual PD: each value [25, 40] */
export function validateDualPD(value: number): ValidationResult {
  if (value < 25 || value > 40) return { valid: false, error: 'Each PD value should be between 25 and 40mm.' };
  return { valid: true };
}

/** Dual PD delta warning */
export function validatePDDelta(right: number, left: number): ValidationResult {
  if (Math.abs(right - left) > 5) return { valid: false, error: 'Large difference between left and right PD is unusual. Please check your measurement.' };
  return { valid: true };
}

/** High sphere warning (soft) */
export function warnHighSphere(value: number): string | null {
  if (Math.abs(value) > 6) return 'High prescriptions may require a high-index lens. We\'ll recommend the right lens material at review.';
  return null;
}

/** Mismatched CYL signs warning (soft) */
export function warnMismatchedCylinder(odCyl: number, osCyl: number): string | null {
  if (odCyl !== 0 && osCyl !== 0 && Math.sign(odCyl) !== Math.sign(osCyl)) return 'Your cylinder values have opposite signs for each eye. This is unusual — please double-check your prescription.';
  return null;
}

/** Prescription date validation */
export function validateRxDate(dateStr: string): { valid: boolean; error?: string; warning?: string } {
  if (!dateStr) return { valid: true };
  const date = new Date(dateStr);
  if (date > new Date()) return { valid: false, error: 'Please enter the date on your prescription.' };
  const months = Math.round((Date.now() - date.getTime()) / (30 * 86400000));
  if (months > 60) return { valid: false, error: 'Prescriptions older than 5 years cannot be used. Please get a current eye exam.' };
  if (months > 24) return { valid: true, warning: 'This prescription is over 2 years old. We recommend scheduling an eye exam.' };
  return { valid: true };
}

/** Prism + base dependency */
export function validatePrismBase(prism: number, base: string): ValidationResult {
  if (prism > 0 && !base) return { valid: false, error: 'Base direction is required when prism is specified.' };
  return { valid: true };
}
