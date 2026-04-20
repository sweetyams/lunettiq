'use client';

import { useState, useEffect, useRef } from 'react';
import type { LensType, PrescriptionData, LensConfiguration } from '@/types/configurator';
import {
  validateSphere,
  validateCylinder,
  validateAxis,
  validatePD,
  validateAddPower,
  validateCylinderAxis,
} from '@/lib/validators/prescription';
import { requiresPrescription, isReaders } from '../LensConfigurator';
import { RxSelect, SoftWarnings, sphOptions, cylOptions, addOptions, axisOptions } from './RxFields';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RxMethod = LensConfiguration['prescriptionMethod'];

interface PrescriptionStepProps {
  lensType: LensType | null;
  prescription: PrescriptionData | null;
  prescriptionMethod: RxMethod;
  readersMagnification: number | null;
  onSubmit: (rx: PrescriptionData | null, method: RxMethod) => void;
  onMagnificationChange: (mag: number) => void;
  onBack: () => void;
}

interface FieldErrors {
  odSphere?: string;
  odCylinder?: string;
  odAxis?: string;
  odAddPower?: string;
  osSphere?: string;
  osCylinder?: string;
  osAxis?: string;
  osAddPower?: string;
  pd?: string;
}

/* ------------------------------------------------------------------ */
/*  Magnification options for Readers                                  */
/* ------------------------------------------------------------------ */

function magnificationOptions(): number[] {
  const opts: number[] = [];
  for (let v = 1.0; v <= 3.5; v += 0.25) {
    opts.push(Math.round(v * 100) / 100);
  }
  return opts;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PrescriptionStep({
  lensType,
  prescription,
  prescriptionMethod,
  readersMagnification,
  onSubmit,
  onMagnificationChange,
  onBack,
}: PrescriptionStepProps) {
  const isProgressive = lensType === 'progressive';
  const isReadersType = isReaders(lensType);
  const needsRx = requiresPrescription(lensType);

  // Active method tab
  const [activeMethod, setActiveMethod] = useState<RxMethod>(prescriptionMethod ?? 'manual');

  // Manual form state
  const [odSphere, setOdSphere] = useState(prescription?.od.sphere ?? 0);
  const [odCylinder, setOdCylinder] = useState(prescription?.od.cylinder ?? 0);
  const [odAxis, setOdAxis] = useState(prescription?.od.axis ?? 0);
  const [odAddPower, setOdAddPower] = useState(prescription?.od.addPower ?? 0);
  const [osSphere, setOsSphere] = useState(prescription?.os.sphere ?? 0);
  const [osCylinder, setOsCylinder] = useState(prescription?.os.cylinder ?? 0);
  const [osAxis, setOsAxis] = useState(prescription?.os.axis ?? 0);
  const [osAddPower, setOsAddPower] = useState(prescription?.os.addPower ?? 0);
  const [pd, setPd] = useState(prescription?.pd ?? 63);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPDGuide, setShowPDGuide] = useState(false);

  // New spec fields
  const [showPrism, setShowPrism] = useState(false);
  const [odPrismH, setOdPrismH] = useState(0);
  const [odBaseH, setOdBaseH] = useState<'in' | 'out' | ''>('');
  const [odPrismV, setOdPrismV] = useState(0);
  const [odBaseV, setOdBaseV] = useState<'up' | 'down' | ''>('');
  const [osPrismH, setOsPrismH] = useState(0);
  const [osBaseH, setOsBaseH] = useState<'in' | 'out' | ''>('');
  const [osPrismV, setOsPrismV] = useState(0);
  const [osBaseV, setOsBaseV] = useState<'up' | 'down' | ''>('');
  const [pdMode, setPdMode] = useState<'single' | 'dual'>('single');
  const [pdRight, setPdRight] = useState(31.5);
  const [pdLeft, setPdLeft] = useState(31.5);
  const [rxDate, setRxDate] = useState('');
  const [prescriberName, setPrescriberName] = useState('');
  const [prescriberClinic, setPrescriberClinic] = useState('');

  // Readers magnification
  const [mag, setMag] = useState(readersMagnification ?? 1.5);

  /* ---- Readers flow ---- */
  if (isReadersType) {
    return (
      <div>
        <h4 className="text-sm font-medium mb-3">Select Magnification</h4>
        <div className="grid grid-cols-4 gap-2">
          {magnificationOptions().map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setMag(v);
                onMagnificationChange(v);
              }}
              className={`
                p-2 rounded-lg border text-sm text-center transition-colors
                ${mag === v ? 'border-black bg-gray-50 font-medium' : 'border-gray-200 hover:border-gray-400'}
              `}
            >
              +{v.toFixed(2)}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between mt-6">
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black transition-colors">
            ← Back
          </button>
          <button
            type="button"
            onClick={() => {
              onMagnificationChange(mag);
              onSubmit(null, 'manual');
            }}
            className="px-6 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  /* ---- Prescription flow ---- */

  function validateForm(): boolean {
    const e: FieldErrors = {};
    // OD
    const sphOD = validateSphere(odSphere);
    if (!sphOD.valid) e.odSphere = sphOD.error;
    const cylOD = validateCylinder(odCylinder);
    if (!cylOD.valid) e.odCylinder = cylOD.error;
    if (odCylinder !== 0) {
      const axOD = validateAxis(odAxis);
      if (!axOD.valid) e.odAxis = axOD.error;
      const crossOD = validateCylinderAxis(odCylinder, odAxis);
      if (!crossOD.valid) e.odAxis = e.odAxis ?? crossOD.error;
    }
    if (isProgressive) {
      const apOD = validateAddPower(odAddPower);
      if (!apOD.valid) e.odAddPower = apOD.error;
    }
    // OS
    const sphOS = validateSphere(osSphere);
    if (!sphOS.valid) e.osSphere = sphOS.error;
    const cylOS = validateCylinder(osCylinder);
    if (!cylOS.valid) e.osCylinder = cylOS.error;
    if (osCylinder !== 0) {
      const axOS = validateAxis(osAxis);
      if (!axOS.valid) e.osAxis = axOS.error;
      const crossOS = validateCylinderAxis(osCylinder, osAxis);
      if (!crossOS.valid) e.osAxis = e.osAxis ?? crossOS.error;
    }
    if (isProgressive) {
      const apOS = validateAddPower(osAddPower);
      if (!apOS.valid) e.osAddPower = apOS.error;
    }
    // PD
    const pdResult = validatePD(pd);
    if (!pdResult.valid) e.pd = pdResult.error;

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleManualSubmit() {
    if (!validateForm()) return;
    const rxData: PrescriptionData = {
      od: { sphere: odSphere, cylinder: odCylinder, axis: odAxis, ...(isProgressive ? { addPower: odAddPower } : {}) },
      os: { sphere: osSphere, cylinder: osCylinder, axis: osAxis, ...(isProgressive ? { addPower: osAddPower } : {}) },
      pd,
    };
    onSubmit(rxData, 'manual');
  }

  function handleUpload() {
    // In a real app this would open a file picker
    onSubmit(null, 'upload');
  }

  function handleSendLater() {
    onSubmit(null, 'sendLater');
  }

  if (!needsRx) return null;

  return (
    <div>
      <h4 className="text-sm font-medium mb-3">Prescription</h4>

      {/* Method tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['manual', 'scan', 'upload', 'optometrist', 'sendLater', 'saved'] as (RxMethod | 'scan' | 'optometrist')[]).map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => method === 'scan' ? window.open('/account/prescriptions/scan', '_blank') : setActiveMethod(method as RxMethod)}
            className={`
              px-3 py-2 text-xs transition-colors border-b-2
              ${activeMethod === method ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}
            `}
          >
            {method === 'manual' && 'Enter Manually'}
            {method === 'scan' && '📷 Scan'}
            {method === 'upload' && 'Upload'}
            {method === 'optometrist' && 'Contact Optometrist'}
            {method === 'sendLater' && 'Send Later'}
            {method === 'saved' && 'Saved Rx'}
          </button>
        ))}
      </div>

      {/* Manual entry */}
      {activeMethod === 'manual' && (
        <div>
          {/* OD (Right Eye) */}
          <EyeFields
            label="OD (Right Eye)"
            sphere={odSphere}
            cylinder={odCylinder}
            axis={odAxis}
            addPower={isProgressive ? odAddPower : undefined}
            errors={{
              sphere: errors.odSphere,
              cylinder: errors.odCylinder,
              axis: errors.odAxis,
              addPower: errors.odAddPower,
            }}
            onSphereChange={setOdSphere}
            onCylinderChange={setOdCylinder}
            onAxisChange={setOdAxis}
            onAddPowerChange={isProgressive ? setOdAddPower : undefined}
          />

          {/* OS (Left Eye) */}
          <EyeFields
            label="OS (Left Eye)"
            sphere={osSphere}
            cylinder={osCylinder}
            axis={osAxis}
            addPower={isProgressive ? osAddPower : undefined}
            errors={{
              sphere: errors.osSphere,
              cylinder: errors.osCylinder,
              axis: errors.osAxis,
              addPower: errors.osAddPower,
            }}
            onSphereChange={setOsSphere}
            onCylinderChange={setOsCylinder}
            onAxisChange={setOsAxis}
            onAddPowerChange={isProgressive ? setOsAddPower : undefined}
          />

          <SoftWarnings odSphere={odSphere} osSphere={osSphere} odCylinder={odCylinder} osCylinder={osCylinder} />

          {/* PD */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">PD (mm)</label>
              <div className="flex gap-2">
                <a href="/account/prescriptions/measure-pd" target="_blank" className="text-xs text-blue-600 hover:underline">📏 Measure with selfie</a>
                <button
                  type="button"
                  onClick={() => setShowPDGuide(!showPDGuide)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  How to measure?
                </button>
              </div>
            </div>
            <input
              type="number"
              min={50}
              max={80}
              step={0.5}
              value={pd}
              onChange={(e) => setPd(parseFloat(e.target.value) || 0)}
              className={`w-24 px-2 py-1.5 border rounded text-sm ${errors.pd ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.pd && <p className="text-xs text-red-500 mt-1">{errors.pd}</p>}

            {/* PD Mode Toggle */}
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setPdMode('single')} className={`px-3 py-1 text-xs rounded ${pdMode === 'single' ? 'bg-black text-white' : 'border border-gray-300'}`}>Single PD</button>
              <button type="button" onClick={() => setPdMode('dual')} className={`px-3 py-1 text-xs rounded ${pdMode === 'dual' ? 'bg-black text-white' : 'border border-gray-300'}`}>Dual PD</button>
            </div>
            {pdMode === 'dual' && (
              <div className="flex gap-3 mt-2">
                <div>
                  <label className="text-xs text-gray-500">Right</label>
                  <input type="number" min={25} max={40} step={0.5} value={pdRight} onChange={e => setPdRight(parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Left</label>
                  <input type="number" min={25} max={40} step={0.5} value={pdLeft} onChange={e => setPdLeft(parseFloat(e.target.value) || 0)} className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Prism (hidden behind toggle) */}
          <div className="mt-4">
            <button type="button" onClick={() => setShowPrism(!showPrism)} className="text-xs text-gray-500 hover:text-black">
              {showPrism ? '− Hide prism correction' : '+ Add prism correction'}
            </button>
            {showPrism && (
              <div className="mt-3 p-3 border border-gray-200 rounded-lg space-y-3">
                <p className="text-xs text-gray-400">Most prescriptions don't have prism. If yours does, your optometrist would have written it next to a direction like "base up" or "base in".</p>
                {(['od', 'os'] as const).map(eye => {
                  const pH = eye === 'od' ? odPrismH : osPrismH;
                  const setPH = eye === 'od' ? setOdPrismH : setOsPrismH;
                  const bH = eye === 'od' ? odBaseH : osBaseH;
                  const setBH = eye === 'od' ? setOdBaseH : setOsBaseH;
                  const pV = eye === 'od' ? odPrismV : osPrismV;
                  const setPV = eye === 'od' ? setOdPrismV : setOsPrismV;
                  const bV = eye === 'od' ? odBaseV : osBaseV;
                  const setBV = eye === 'od' ? setOdBaseV : setOsBaseV;
                  return (
                    <div key={eye}>
                      <div className="text-xs font-medium mb-1">{eye === 'od' ? 'Right Eye (OD)' : 'Left Eye (OS)'}</div>
                      <div className="grid grid-cols-4 gap-2">
                        <div><label className="text-xs text-gray-400">H Prism</label><input type="number" min={0} max={10} step={0.25} value={pH} onChange={e => setPH(parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border border-gray-200 rounded text-xs" /></div>
                        <div><label className="text-xs text-gray-400">H Base</label><select value={bH} onChange={e => setBH(e.target.value as any)} className="w-full px-1 py-1 border border-gray-200 rounded text-xs"><option value="">—</option><option value="in">In</option><option value="out">Out</option></select></div>
                        <div><label className="text-xs text-gray-400">V Prism</label><input type="number" min={0} max={10} step={0.25} value={pV} onChange={e => setPV(parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border border-gray-200 rounded text-xs" /></div>
                        <div><label className="text-xs text-gray-400">V Base</label><select value={bV} onChange={e => setBV(e.target.value as any)} className="w-full px-1 py-1 border border-gray-200 rounded text-xs"><option value="">—</option><option value="up">Up</option><option value="down">Down</option></select></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prescription date + prescriber */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Prescription Date</label>
              <input type="date" value={rxDate} onChange={e => setRxDate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mt-1" />
              {rxDate && (() => {
                const months = Math.round((Date.now() - new Date(rxDate).getTime()) / (30 * 86400000));
                if (months > 60) return <p className="text-xs text-red-500 mt-1">Prescriptions older than 5 years cannot be used. Please get a current eye exam.</p>;
                if (months > 24) return <p className="text-xs text-amber-600 mt-1">This prescription is over 2 years old. We recommend scheduling an eye exam. <a href="/account/appointments" className="underline">Book an exam</a></p>;
                return null;
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Prescriber Name</label>
                <input value={prescriberName} onChange={e => setPrescriberName(e.target.value)} placeholder="Dr. Smith" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Clinic</label>
                <input value={prescriberClinic} onChange={e => setPrescriberClinic(e.target.value)} placeholder="Optional" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mt-1" />
              </div>
            </div>
          </div>

          {/* PD Guide overlay */}
          {showPDGuide && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-gray-700">
              <p className="font-medium mb-1">PD Measurement Guide</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>Stand 20 cm from a mirror with a ruler.</li>
                <li>Close your right eye. Align 0 mm with the centre of your left pupil.</li>
                <li>Open your right eye and close your left. Read the measurement at the centre of your right pupil.</li>
                <li>That number (in mm) is your PD. Most adults are between 54–74 mm.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowPDGuide(false)}
                className="mt-2 text-blue-600 hover:underline"
              >
                Close
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black transition-colors">
              ← Back
            </button>
            <button
              type="button"
              onClick={handleManualSubmit}
              className="px-6 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Upload */}
      {activeMethod === 'upload' && (
        <UploadPanel onUploaded={() => onSubmit(null, 'upload')} onBack={onBack} />
      )}

      {/* Contact Optometrist */}
      {activeMethod === ('optometrist' as any) && (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            We'll contact your optometrist directly to get your prescription. Just tell us who to call.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Optometrist Name</label>
              <input value={prescriberName} onChange={e => setPrescriberName(e.target.value)} placeholder="Dr. Smith" className="w-full px-3 py-2 border border-gray-300 rounded text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Clinic Name</label>
              <input value={prescriberClinic} onChange={e => setPrescriberClinic(e.target.value)} placeholder="Vision Plus Clinic" className="w-full px-3 py-2 border border-gray-300 rounded text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">Clinic Phone</label>
              <input type="tel" id="optometristPhone" placeholder="(514) 555-0123" className="w-full px-3 py-2 border border-gray-300 rounded text-sm mt-1" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">We'll reach out within 48 hours (1 hour for CULT+ members). Your order will be held until we receive your prescription.</p>
          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black transition-colors">← Back</button>
            <button type="button" onClick={() => onSubmit(null, 'sendLater')} disabled={!prescriberName}
              className="px-6 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors disabled:opacity-50">
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Send Later */}
      {activeMethod === 'sendLater' && (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Don&apos;t have your prescription handy? No problem — complete your order now and email your prescription to us later.
          </p>
          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black transition-colors">
              ← Back
            </button>
            <button
              type="button"
              onClick={handleSendLater}
              className="px-6 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
            >
              Continue without Rx
            </button>
          </div>
        </div>
      )}

      {/* Saved Rx */}
      {activeMethod === 'saved' && (
        <SavedRxPanel onSelect={(rx) => {
          setOdSphere(rx.odSphere ?? 0); setOdCylinder(rx.odCylinder ?? 0); setOdAxis(rx.odAxis ?? 0);
          setOsSphere(rx.osSphere ?? 0); setOsCylinder(rx.osCylinder ?? 0); setOsAxis(rx.osAxis ?? 0);
          if (rx.pd) setPd(rx.pd);
          onSubmit({ od: { sphere: rx.odSphere ?? 0, cylinder: rx.odCylinder ?? 0, axis: rx.odAxis ?? 0, addPower: 0 }, os: { sphere: rx.osSphere ?? 0, cylinder: rx.osCylinder ?? 0, axis: rx.osAxis ?? 0, addPower: 0 }, pd: rx.pd ?? 63 }, 'saved');
        }} onBack={onBack} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Eye Fields sub-component                                           */
/* ------------------------------------------------------------------ */

function EyeFields({
  label, sphere, cylinder, axis, addPower, errors,
  onSphereChange, onCylinderChange, onAxisChange, onAddPowerChange,
}: {
  label: string; sphere: number; cylinder: number; axis: number; addPower?: number;
  errors: { sphere?: string; cylinder?: string; axis?: string; addPower?: string };
  onSphereChange: (v: number) => void; onCylinderChange: (v: number) => void;
  onAxisChange: (v: number) => void; onAddPowerChange?: (v: number) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-gray-700 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <RxSelect label="Sphere (SPH)" value={sphere} onChange={onSphereChange} options={sphOptions()} error={errors.sphere} />
        <RxSelect label="Cylinder (CYL)" value={cylinder} onChange={onCylinderChange} options={cylOptions()} error={errors.cylinder} />
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">Axis</label>
          <select value={axis} onChange={e => onAxisChange(Number(e.target.value))} disabled={cylinder === 0}
            className={`w-full px-2 py-1.5 border rounded text-sm ${errors.axis ? 'border-red-500' : cylinder === 0 ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-gray-300'}`}>
            <option value={0}>—</option>
            {axisOptions().map(a => <option key={a} value={a}>{a}°</option>)}
          </select>
          {errors.axis && <p className="text-xs text-red-500 mt-0.5">{errors.axis}</p>}
          {cylinder === 0 && <p className="text-[10px] text-gray-400 mt-0.5">Only needed with cylinder</p>}
        </div>
      </div>
      {addPower !== undefined && onAddPowerChange && (
        <div className="mt-2">
          <RxSelect label="Addition (ADD)" value={addPower} onChange={onAddPowerChange} options={addOptions()} error={errors.addPower} className="w-32" />
        </div>
      )}
    </div>
  );
}

function SavedRxPanel({ onSelect, onBack }: { onSelect: (rx: any) => void; onBack: () => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try API first, then localStorage
    fetch('/api/account/prescriptions', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.records?.length) { setRecords(d.records); setLoading(false); return; } throw new Error(); })
      .catch(() => {
        try { const local = JSON.parse(localStorage.getItem('lunettiq_prescriptions') ?? '[]'); setRecords(local); } catch {}
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-sm text-gray-400 py-4">Loading saved prescriptions…</p>;

  if (!records.length) return (
    <div>
      <p className="text-sm text-gray-500 mb-4">No saved prescriptions found. <a href="/account/prescriptions/scan" className="underline">Scan one</a> or enter manually.</p>
      <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black">← Back</button>
    </div>
  );

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">Select a prescription to use:</p>
      <div className="space-y-2">
        {records.map((rx: any, i: number) => {
          const months = rx.date ? Math.round((Date.now() - new Date(rx.date).getTime()) / (30 * 86400000)) : null;
          const expired = months !== null && months > 24;
          return (
            <button key={rx.id ?? i} type="button" onClick={() => !expired && onSelect(rx)}
              className={`w-full text-left border rounded-lg p-3 transition-colors ${expired ? 'border-red-200 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-black'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{rx.label ?? 'Prescription'}</span>
                {rx.date && <span className="text-xs text-gray-400">{rx.date}</span>}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                OD: {rx.odSphere ?? 0}/{rx.odCylinder ?? 0} · OS: {rx.osSphere ?? 0}/{rx.osCylinder ?? 0}{rx.pd ? ` · PD: ${rx.pd}` : ''}
              </div>
              {expired && <p className="text-xs text-red-500 mt-1">Expired — please update your prescription</p>}
              {months !== null && months > 18 && !expired && <p className="text-xs text-amber-600 mt-1">Expiring soon — consider an eye exam</p>}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black mt-4">← Back</button>
    </div>
  );
}

function UploadPanel({ onUploaded, onBack }: { onUploaded: () => void; onBack: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f));
    else setPreview(null); // PDF — can't preview inline
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">Upload a photo or scan of your prescription. We'll verify it before processing.</p>
      {preview && (
        <div className="mb-3 border border-gray-200 rounded-lg overflow-hidden">
          <img src={preview} alt="Prescription preview" className="w-full max-h-48 object-contain bg-gray-50" />
        </div>
      )}
      {file && !preview && <p className="text-sm text-gray-600 mb-3">📄 {file.name}</p>}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-black'); }}
        onDragLeave={e => e.currentTarget.classList.remove('border-black')}
        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-black'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
        <p className="text-sm text-gray-400 mb-2">{file ? 'Replace file' : 'Drag & drop or click to upload'}</p>
        <button type="button" onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-gray-100 text-sm rounded hover:bg-gray-200">Choose File</button>
        <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
        <p className="text-xs text-gray-400 mt-2">PDF, JPG, PNG · Max 10MB</p>
      </div>
      <div className="flex items-center justify-between mt-6">
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black">← Back</button>
        <button type="button" onClick={onUploaded} disabled={!file} className="px-6 py-2 bg-black text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50">Continue</button>
      </div>
    </div>
  );
}
