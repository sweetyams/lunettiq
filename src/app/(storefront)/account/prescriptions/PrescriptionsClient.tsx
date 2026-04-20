'use client';

import { useState, useEffect } from 'react';
import type { PrescriptionRecord } from '@/types/customer';
import {
  validateSphere,
  validateCylinder,
  validateAxis,
  validatePD,
  validateCylinderAxis,
} from '@/lib/validators/prescription';

interface PrescriptionsClientProps {
  initialRecords: PrescriptionRecord[];
}

export default function PrescriptionsClient({ initialRecords }: PrescriptionsClientProps) {
  const [records, setRecords] = useState<PrescriptionRecord[]>(initialRecords);
  const [showForm, setShowForm] = useState(false);

  // Merge localStorage prescriptions
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem('lunettiq_prescriptions') ?? '[]');
      if (local.length) {
        const existingIds = new Set(initialRecords.map((r: any) => r.id));
        const merged = [...initialRecords, ...local.filter((r: any) => !existingIds.has(r.id))];
        setRecords(merged);
      }
    } catch {}
  }, [initialRecords]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [optometristName, setOptometristName] = useState('');
  const [date, setDate] = useState('');
  const [odSphere, setOdSphere] = useState('');
  const [odCylinder, setOdCylinder] = useState('');
  const [odAxis, setOdAxis] = useState('');
  const [osSphere, setOsSphere] = useState('');
  const [osCylinder, setOsCylinder] = useState('');
  const [osAxis, setOsAxis] = useState('');
  const [pd, setPd] = useState('');

  function resetForm() {
    setOptometristName('');
    setDate('');
    setOdSphere('');
    setOdCylinder('');
    setOdAxis('');
    setOsSphere('');
    setOsCylinder('');
    setOsAxis('');
    setPd('');
    setErrors({});
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!optometristName.trim()) newErrors.optometristName = 'Required';
    if (!date) newErrors.date = 'Required';

    const odSph = Number(odSphere);
    const odCyl = Number(odCylinder);
    const odAx = Number(odAxis);
    const osSph = Number(osSphere);
    const osCyl = Number(osCylinder);
    const osAx = Number(osAxis);
    const pdVal = Number(pd);

    const sphR = validateSphere(odSph);
    if (!sphR.valid) newErrors.odSphere = sphR.error!;
    const cylR = validateCylinder(odCyl);
    if (!cylR.valid) newErrors.odCylinder = cylR.error!;
    if (odCyl !== 0) {
      const axR = validateAxis(odAx);
      if (!axR.valid) newErrors.odAxis = axR.error!;
      const caR = validateCylinderAxis(odCyl, odAx);
      if (!caR.valid) newErrors.odAxis = caR.error!;
    }

    const sphL = validateSphere(osSph);
    if (!sphL.valid) newErrors.osSphere = sphL.error!;
    const cylL = validateCylinder(osCyl);
    if (!cylL.valid) newErrors.osCylinder = cylL.error!;
    if (osCyl !== 0) {
      const axL = validateAxis(osAx);
      if (!axL.valid) newErrors.osAxis = axL.error!;
      const caL = validateCylinderAxis(osCyl, osAx);
      if (!caL.valid) newErrors.osAxis = caL.error!;
    }

    const pdR = validatePD(pdVal);
    if (!pdR.valid) newErrors.pd = pdR.error!;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const newRecord: PrescriptionRecord = {
      id: crypto.randomUUID(),
      optometristName: optometristName.trim(),
      date,
      od: { sphere: Number(odSphere), cylinder: Number(odCylinder), axis: Number(odAxis) || 0 },
      os: { sphere: Number(osSphere), cylinder: Number(osCylinder), axis: Number(osAxis) || 0 },
      pd: Number(pd),
    };

    const updated = [...records, newRecord];
    try {
      await fetch('/api/account/prescriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: updated }),
      });
      setRecords(updated);
      resetForm();
      setShowForm(false);
    } catch {
      // silent
    }
    // Also save to localStorage as backup
    try {
      const local = JSON.parse(localStorage.getItem('lunettiq_prescriptions') ?? '[]');
      local.unshift({ id: newRecord.id, label: newRecord.optometristName || 'Manual entry', date: newRecord.date, odSphere: newRecord.od.sphere, odCylinder: newRecord.od.cylinder, odAxis: newRecord.od.axis, osSphere: newRecord.os.sphere, osCylinder: newRecord.os.cylinder, osAxis: newRecord.os.axis, pd: newRecord.pd });
      localStorage.setItem('lunettiq_prescriptions', JSON.stringify(local));
    } catch {}
    finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const updated = records.filter((r) => r.id !== id);
    try {
      await fetch('/api/account/prescriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: updated }),
      });
      setRecords(updated);
    } catch {
      // silent
    }
  }

  return (
    <div>
      {/* Existing prescriptions */}
      {records.length > 0 ? (
        <div className="space-y-4 mb-8">
          {records.map((rec) => (
            <div key={rec.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">{rec.optometristName}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(rec.date).toLocaleDateString('en-CA')}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(rec.id)}
                  className="text-xs text-red-500 hover:text-red-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Delete prescription"
                >
                  Delete
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-medium text-gray-500 mb-1">Right Eye (OD)</p>
                  <p>SPH: {(rec.od?.sphere ?? (rec as any).odSphere ?? 0).toFixed?.(2) ?? rec.od?.sphere ?? (rec as any).odSphere ?? 0}</p>
                  <p>CYL: {(rec.od?.cylinder ?? (rec as any).odCylinder ?? 0).toFixed?.(2) ?? 0}</p>
                  <p>AXIS: {rec.od?.axis ?? (rec as any).odAxis ?? 0}°</p>
                </div>
                <div>
                  <p className="font-medium text-gray-500 mb-1">Left Eye (OS)</p>
                  <p>SPH: {(rec.os?.sphere ?? (rec as any).osSphere ?? 0).toFixed?.(2) ?? rec.os?.sphere ?? (rec as any).osSphere ?? 0}</p>
                  <p>CYL: {(rec.os?.cylinder ?? (rec as any).osCylinder ?? 0).toFixed?.(2) ?? 0}</p>
                  <p>AXIS: {rec.os?.axis ?? (rec as any).osAxis ?? 0}°</p>
                </div>
              </div>
              <p className="text-xs mt-2">PD: {rec.pd ?? (rec as any).pd ?? '—'} mm</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-8">No saved prescriptions.</p>
      )}

      {/* Add new */}
      {!showForm ? (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors"
          >
            Add Manually
          </button>
          <a href="/account/prescriptions/scan" className="px-6 py-2 border border-black text-sm rounded-full hover:bg-black hover:text-white transition-colors">
            📷 Scan Prescription
          </a>
          <a href="/account/prescriptions/measure-pd" className="px-6 py-2 border border-gray-300 text-sm rounded-full hover:border-black transition-colors">
            📏 Measure PD
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-medium mb-2">New Prescription</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Optometrist" value={optometristName} onChange={setOptometristName} error={errors.optometristName} />
            <Field label="Date" value={date} onChange={setDate} type="date" error={errors.date} />
          </div>

          <p className="text-xs font-medium text-gray-500 mt-4">Right Eye (OD)</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Sphere" value={odSphere} onChange={setOdSphere} type="number" step="0.25" error={errors.odSphere} />
            <Field label="Cylinder" value={odCylinder} onChange={setOdCylinder} type="number" step="0.25" error={errors.odCylinder} />
            <Field label="Axis" value={odAxis} onChange={setOdAxis} type="number" step="1" error={errors.odAxis} />
          </div>

          <p className="text-xs font-medium text-gray-500 mt-4">Left Eye (OS)</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Sphere" value={osSphere} onChange={setOsSphere} type="number" step="0.25" error={errors.osSphere} />
            <Field label="Cylinder" value={osCylinder} onChange={setOsCylinder} type="number" step="0.25" error={errors.osCylinder} />
            <Field label="Axis" value={osAxis} onChange={setOsAxis} type="number" step="1" error={errors.osAxis} />
          </div>

          <div className="max-w-[200px]">
            <Field label="PD (mm)" value={pd} onChange={setPd} type="number" step="0.5" error={errors.pd} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save Prescription'}
            </button>
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(false); }}
              className="text-sm text-gray-500 hover:text-black"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  step,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded px-3 py-2 text-sm ${error ? 'border-red-400' : 'border-gray-300'} focus:outline-none focus:border-black`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
