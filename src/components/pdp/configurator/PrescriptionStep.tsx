'use client';

import { useState } from 'react';
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
        {(['manual', 'upload', 'sendLater', 'saved'] as RxMethod[]).map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => setActiveMethod(method)}
            className={`
              px-3 py-2 text-xs transition-colors border-b-2
              ${activeMethod === method ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}
            `}
          >
            {method === 'manual' && 'Enter Manually'}
            {method === 'upload' && 'Upload Image'}
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

          {/* PD */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">PD (mm)</label>
              <button
                type="button"
                onClick={() => setShowPDGuide(!showPDGuide)}
                className="text-xs text-blue-600 hover:underline"
              >
                How to measure PD?
              </button>
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
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Upload a photo or scan of your prescription. We&apos;ll verify it before processing your order.
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-sm text-gray-400 mb-2">Drag &amp; drop or click to upload</p>
            <button
              type="button"
              onClick={handleUpload}
              className="px-4 py-2 bg-gray-100 text-sm rounded hover:bg-gray-200 transition-colors"
            >
              Choose File
            </button>
          </div>
          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black transition-colors">
              ← Back
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
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Log in to access your saved prescriptions.
          </p>
          <div className="flex items-center justify-between mt-6">
            <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-black transition-colors">
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Eye Fields sub-component                                           */
/* ------------------------------------------------------------------ */

function EyeFields({
  label,
  sphere,
  cylinder,
  axis,
  addPower,
  errors,
  onSphereChange,
  onCylinderChange,
  onAxisChange,
  onAddPowerChange,
}: {
  label: string;
  sphere: number;
  cylinder: number;
  axis: number;
  addPower?: number;
  errors: { sphere?: string; cylinder?: string; axis?: string; addPower?: string };
  onSphereChange: (v: number) => void;
  onCylinderChange: (v: number) => void;
  onAxisChange: (v: number) => void;
  onAddPowerChange?: (v: number) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-gray-700 mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500">Sphere</label>
          <input
            type="number"
            min={-20}
            max={20}
            step={0.25}
            value={sphere}
            onChange={(e) => onSphereChange(parseFloat(e.target.value) || 0)}
            className={`w-full px-2 py-1.5 border rounded text-sm ${errors.sphere ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.sphere && <p className="text-[10px] text-red-500 mt-0.5">{errors.sphere}</p>}
        </div>
        <div>
          <label className="text-[10px] text-gray-500">Cylinder</label>
          <input
            type="number"
            min={-6}
            max={6}
            step={0.25}
            value={cylinder}
            onChange={(e) => onCylinderChange(parseFloat(e.target.value) || 0)}
            className={`w-full px-2 py-1.5 border rounded text-sm ${errors.cylinder ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.cylinder && <p className="text-[10px] text-red-500 mt-0.5">{errors.cylinder}</p>}
        </div>
        <div>
          <label className="text-[10px] text-gray-500">Axis</label>
          <input
            type="number"
            min={1}
            max={180}
            step={1}
            value={axis}
            onChange={(e) => onAxisChange(parseInt(e.target.value) || 0)}
            className={`w-full px-2 py-1.5 border rounded text-sm ${errors.axis ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.axis && <p className="text-[10px] text-red-500 mt-0.5">{errors.axis}</p>}
        </div>
      </div>
      {addPower !== undefined && onAddPowerChange && (
        <div className="mt-2">
          <label className="text-[10px] text-gray-500">Add Power</label>
          <input
            type="number"
            min={0.5}
            max={3.5}
            step={0.25}
            value={addPower}
            onChange={(e) => onAddPowerChange(parseFloat(e.target.value) || 0)}
            className={`w-24 px-2 py-1.5 border rounded text-sm ${errors.addPower ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.addPower && <p className="text-[10px] text-red-500 mt-0.5">{errors.addPower}</p>}
        </div>
      )}
    </div>
  );
}
