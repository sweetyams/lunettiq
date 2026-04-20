'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface RxEye { sphere: number | null; cylinder: number | null; axis: number | null; add: number | null; prismH?: number | null; baseH?: string | null; prismV?: number | null; baseV?: string | null }
interface ScanResult { success: boolean; od: RxEye; os: RxEye; pd: number | null; pdRight: number | null; pdLeft: number | null; prescriptionDate: string | null; prescriberName: string | null; prescriberClinic: string | null; notes: string; confidence: string; error?: string }

const EMPTY_EYE: RxEye = { sphere: null, cylinder: null, axis: null, add: null };

export default function PrescriptionScanPage() {
  const [step, setStep] = useState<'capture' | 'scanning' | 'review' | 'saving'>('capture');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 1280, height: 960 } });
      if (videoRef.current) { videoRef.current.srcObject = stream; setCameraActive(true); }
    } catch { setError('Camera access denied'); }
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const f = new File([blob], 'prescription.jpg', { type: 'image/jpeg' });
      setFile(f);
      setPreview(canvas.toDataURL('image/jpeg'));
      stopCamera();
      scan(f);
    }, 'image/jpeg', 0.9);
  }

  function stopCamera() {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    scan(f);
  }

  async function scan(f: File) {
    setStep('scanning'); setError('');
    const form = new FormData();
    form.append('image', f);
    try {
      const res = await fetch('/api/account/prescriptions/scan', { method: 'POST', body: form });
      const d = await res.json();
      if (d.data?.success === false) { setError(d.data.error || 'Could not read prescription'); setStep('capture'); return; }
      if (d.error) { setError(d.error); setStep('capture'); return; }
      setResult(d.data);
      setStep('review');
    } catch { setError('Scan failed'); setStep('capture'); }
  }

  function updateEye(eye: 'od' | 'os', field: keyof RxEye, value: string) {
    if (!result) return;
    const v = value === '' ? null : Number(value);
    setResult({ ...result, [eye]: { ...result[eye], [field]: v } });
  }

  async function handleSave() {
    if (!result) return;
    setStep('saving');
    const record = {
      id: Date.now().toString(),
      label: 'Scanned Prescription',
      date: result.prescriptionDate ?? new Date().toISOString().slice(0, 10),
      prescriberName: result.prescriberName,
      prescriberClinic: result.prescriberClinic,
      odSphere: result.od.sphere, odCylinder: result.od.cylinder, odAxis: result.od.axis,
      osSphere: result.os.sphere, osCylinder: result.os.cylinder, osAxis: result.os.axis,
      pd: result.pd ?? undefined,
    };
    // Try saving to API, fall back to localStorage
    const res = await fetch('/api/account/prescriptions', {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [record] }),
    });
    if (res.ok) { setSaved(true); setStep('review'); return; }
    // Fallback: save to localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('lunettiq_prescriptions') ?? '[]');
      existing.unshift(record);
      localStorage.setItem('lunettiq_prescriptions', JSON.stringify(existing));
      setSaved(true);
    } catch { setError('Failed to save'); }
    setStep('review');
  }

  if (saved) return (
    <div className="site-container py-16 text-center">
      <div className="text-4xl mb-4">✓</div>
      <h1 className="text-2xl font-medium mb-2">Prescription Saved</h1>
      <p className="text-gray-500 mb-6">Your scanned prescription has been saved to your account.</p>
      <Link href="/account/prescriptions" className="text-sm underline">View prescriptions →</Link>
    </div>
  );

  return (
    <div className="site-container py-12">
      <Link href="/account/prescriptions" className="text-sm text-gray-400 hover:text-black">← Prescriptions</Link>
      <h1 className="text-2xl font-medium mt-4 mb-2">Scan Prescription</h1>
      <p className="text-sm text-gray-500 mb-6">Take a photo of your prescription paper and we'll extract the values automatically.</p>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>}

      {/* Capture step */}
      {step === 'capture' && (
        <div>
          {cameraActive ? (
            <div className="relative mb-4">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-black" />
                <button onClick={() => { stopCamera(); }} className="px-4 py-2 bg-black/50 text-white text-sm rounded-lg">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={startCamera} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-black hover:text-black transition-colors">
                📷 Take a Photo
              </button>
              <button onClick={() => fileRef.current?.click()} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-black hover:text-black transition-colors">
                📁 Upload from Gallery
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          )}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-700">Tips for best results:</p>
            <p>• Place prescription on a flat, well-lit surface</p>
            <p>• Make sure all text is visible and in focus</p>
            <p>• Include both OD (right) and OS (left) eye values</p>
          </div>
        </div>
      )}

      {/* Scanning */}
      {step === 'scanning' && (
        <div className="text-center py-12">
          {preview && <img src={preview} alt="Prescription" className="w-full rounded-lg mb-6 opacity-50" />}
          <div className="text-lg font-medium mb-2">Reading prescription…</div>
          <p className="text-sm text-gray-500">This takes a few seconds</p>
        </div>
      )}

      {/* Review */}
      {step === 'review' && result && (
        <div>
          {preview && <img src={preview} alt="Prescription" className="w-full rounded-lg mb-4" style={{ maxHeight: 200, objectFit: 'contain' }} />}

          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${result.confidence === 'high' ? 'bg-green-100 text-green-700' : result.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
              {result.confidence} confidence
            </span>
            {result.notes && <span className="text-xs text-gray-500">{result.notes}</span>}
          </div>

          {/* Rx table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs text-gray-500">Eye</th><th className="px-3 py-2 text-xs text-gray-500">SPH</th><th className="px-3 py-2 text-xs text-gray-500">CYL</th><th className="px-3 py-2 text-xs text-gray-500">Axis</th><th className="px-3 py-2 text-xs text-gray-500">ADD</th></tr></thead>
              <tbody>
                {(['od', 'os'] as const).map(eye => (
                  <tr key={eye} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-xs">{eye === 'od' ? 'OD (Right)' : 'OS (Left)'}</td>
                    {(['sphere', 'cylinder', 'axis', 'add'] as const).map(f => (
                      <td key={f} className="px-1 py-1">
                        <input type="number" step={f === 'axis' ? 1 : 0.25} value={result[eye][f] ?? ''} onChange={e => updateEye(eye, f, e.target.value)}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PD */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">PD (single)</div>
              <input type="number" step={0.5} value={result.pd ?? ''} onChange={e => setResult({ ...result, pd: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-center" placeholder="63" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">PD Right</div>
              <input type="number" step={0.5} value={result.pdRight ?? ''} onChange={e => setResult({ ...result, pdRight: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-center" placeholder="31.5" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">PD Left</div>
              <input type="number" step={0.5} value={result.pdLeft ?? ''} onChange={e => setResult({ ...result, pdLeft: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-center" placeholder="31.5" />
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-4">Review and correct any values before saving. Don't have your PD? <Link href="/account/prescriptions/measure-pd" className="underline">Measure it with a selfie →</Link></p>

          {/* Date + Prescriber */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Prescription Date</div>
              <input type="date" value={result.prescriptionDate ?? ''} onChange={e => setResult({ ...result, prescriptionDate: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />
              {result.prescriptionDate && (() => {
                const months = Math.round((Date.now() - new Date(result.prescriptionDate).getTime()) / (30 * 86400000));
                if (months > 60) return <p className="text-xs text-red-500 mt-1">Over 5 years old — cannot be used.</p>;
                if (months > 24) return <p className="text-xs text-amber-600 mt-1">Over 2 years old — consider an eye exam.</p>;
                return null;
              })()}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Prescriber</div>
              <input value={result.prescriberName ?? ''} onChange={e => setResult({ ...result, prescriberName: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Dr. Smith" />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Clinic</div>
              <input value={result.prescriberClinic ?? ''} onChange={e => setResult({ ...result, prescriberClinic: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm" placeholder="Optional" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep('capture'); setResult(null); setPreview(null); }} className="flex-1 py-3 border border-gray-200 text-sm rounded-lg hover:border-black transition-colors">Retake</button>
            <button onClick={handleSave} className="flex-1 py-3 bg-black text-white text-sm rounded-lg hover:bg-gray-800">Save Prescription</button>
          </div>
        </div>
      )}

      {step === 'saving' && <div className="text-center py-12 text-gray-500">Saving…</div>}
    </div>
  );
}
