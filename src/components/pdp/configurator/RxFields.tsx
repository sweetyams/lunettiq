'use client';

import { warnHighSphere, warnMismatchedCylinder } from '@/lib/validators/prescription';

// Generate dropdown options
export function sphOptions(): { value: number; label: string }[] {
  const opts = [{ value: 0, label: '0.00 (Plano)' }];
  for (let v = 0.25; v <= 20; v += 0.25) {
    opts.push({ value: v, label: `+${v.toFixed(2)}` });
    opts.unshift({ value: -v, label: v.toFixed(2).replace(/^/, '-') });
  }
  return opts;
}

export function cylOptions(): { value: number; label: string }[] {
  const opts = [{ value: 0, label: 'None' }];
  for (let v = 0.25; v <= 6; v += 0.25) {
    opts.push({ value: -v, label: `-${v.toFixed(2)}` });
    opts.push({ value: v, label: `+${v.toFixed(2)}` });
  }
  return opts.sort((a, b) => a.value - b.value);
}

export function addOptions(): { value: number; label: string }[] {
  const opts = [];
  for (let v = 0.25; v <= 3.5; v += 0.25) { opts.push({ value: v, label: `+${v.toFixed(2)}` }); }
  return opts;
}

export function axisOptions(): number[] {
  return Array.from({ length: 180 }, (_, i) => i + 1);
}

interface RxSelectProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
  error?: string;
  warning?: string;
  className?: string;
}

export function RxSelect({ label, value, onChange, options, error, warning, className }: RxSelectProps) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        className={`w-full px-2 py-1.5 border rounded text-sm ${error ? 'border-red-500' : 'border-gray-300'}`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
      {warning && !error && <p className="text-xs text-amber-600 mt-0.5">{warning}</p>}
    </div>
  );
}

interface SoftWarningsProps {
  odSphere: number; osSphere: number; odCylinder: number; osCylinder: number;
}

export function SoftWarnings({ odSphere, osSphere, odCylinder, osCylinder }: SoftWarningsProps) {
  const warnings: string[] = [];
  const w1 = warnHighSphere(odSphere); if (w1) warnings.push(`OD: ${w1}`);
  const w2 = warnHighSphere(osSphere); if (w2 && w2 !== w1) warnings.push(`OS: ${w2}`);
  const w3 = warnMismatchedCylinder(odCylinder, osCylinder); if (w3) warnings.push(w3);

  if (!warnings.length) return null;
  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 space-y-1">
      {warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
    </div>
  );
}
