'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

// Standard credit card width in mm
const CARD_WIDTH_MM = 85.6;

export default function MeasurePDPage() {
  const [step, setStep] = useState<'intro' | 'capture' | 'measuring' | 'result'>('intro');
  const [pd, setPd] = useState<number | null>(null);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cardPixelWidth, setCardPixelWidth] = useState<number | null>(null);
  const [leftPupil, setLeftPupil] = useState<{ x: number; y: number } | null>(null);
  const [rightPupil, setRightPupil] = useState<{ x: number; y: number } | null>(null);
  const [clickStep, setClickStep] = useState<'card-left' | 'card-right' | 'left-pupil' | 'right-pupil' | 'done'>('card-left');
  const [cardLeft, setCardLeft] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280, height: 960 } });
      if (videoRef.current) { videoRef.current.srcObject = stream; setStep('capture'); }
    } catch { setError('Camera access denied'); }
  }

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
    setPreview(canvas.toDataURL('image/jpeg'));
    // Stop camera
    const stream = videoRef.current.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setStep('measuring');
    setClickStep('card-left');
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (clickStep === 'card-left') {
      setCardLeft(x);
      setClickStep('card-right');
    } else if (clickStep === 'card-right' && cardLeft !== null) {
      setCardPixelWidth(Math.abs(x - cardLeft));
      setClickStep('left-pupil');
    } else if (clickStep === 'left-pupil') {
      setLeftPupil({ x, y });
      setClickStep('right-pupil');
    } else if (clickStep === 'right-pupil') {
      setRightPupil({ x, y });
      setClickStep('done');

      // Calculate PD
      if (leftPupil && cardPixelWidth) {
        const pupilDistPx = Math.abs(x - leftPupil.x);
        const mmPerPx = CARD_WIDTH_MM / cardPixelWidth;
        const pdMm = Math.round(pupilDistPx * mmPerPx * 10) / 10;
        setPd(pdMm);
        setStep('result');
      }
    }
  }

  const instructions: Record<string, string> = {
    'card-left': 'Click the LEFT edge of the credit card',
    'card-right': 'Click the RIGHT edge of the credit card',
    'left-pupil': 'Click the center of your LEFT pupil',
    'right-pupil': 'Click the center of your RIGHT pupil',
  };

  return (
    <div className="site-container py-12">
      <Link href="/account/prescriptions" className="text-sm text-gray-400 hover:text-black">← Prescriptions</Link>
      <h1 className="text-2xl font-medium mt-4 mb-2">Measure Your PD</h1>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>}

      {step === 'intro' && (
        <div>
          <p className="text-sm text-gray-500 mb-6">Measure your pupillary distance (PD) using a selfie and a credit card for scale.</p>
          <div className="border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-medium mb-3">What you'll need</h2>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>📷 Front-facing camera</li>
              <li>💳 A standard credit card (for scale reference)</li>
              <li>💡 Good lighting, face the camera straight on</li>
            </ul>
          </div>
          <div className="border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-medium mb-3">How it works</h2>
            <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
              <li>Hold a credit card against your forehead (horizontally)</li>
              <li>Take a selfie looking straight at the camera</li>
              <li>Mark the card edges and your pupils on the photo</li>
              <li>We calculate your PD using the card as a size reference</li>
            </ol>
          </div>
          <button onClick={startCamera} className="w-full py-3 bg-black text-white text-sm rounded-lg hover:bg-gray-800">Start Measurement</button>
        </div>
      )}

      {step === 'capture' && (
        <div>
          <p className="text-sm text-gray-500 mb-3">Hold a credit card against your forehead and look straight at the camera.</p>
          <div className="relative mb-4">
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" style={{ transform: 'scaleX(-1)' }} />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <button onClick={captureFrame} className="w-16 h-16 bg-white rounded-full border-4 border-black" />
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {step === 'measuring' && (
        <div>
          <div className="mb-3 p-3 bg-blue-50 text-blue-700 text-sm rounded font-medium">{instructions[clickStep]}</div>
          <canvas ref={canvasRef} onClick={handleCanvasClick} className="w-full rounded-lg cursor-crosshair border border-gray-200" style={{ transform: 'scaleX(-1)' }} />
          <button onClick={() => { setStep('intro'); setClickStep('card-left'); setCardLeft(null); setCardPixelWidth(null); setLeftPupil(null); setRightPupil(null); }}
            className="mt-3 text-sm text-gray-400 hover:text-black">Start over</button>
        </div>
      )}

      {step === 'result' && pd !== null && (
        <div className="text-center py-8">
          <div className="text-5xl font-semibold mb-2">{pd} mm</div>
          <div className="text-sm text-gray-500 mb-6">Your pupillary distance</div>
          <div className="border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-600">
            {pd >= 54 && pd <= 74 ? (
              <p className="text-green-600">✓ This is within the normal range (54–74mm)</p>
            ) : (
              <p className="text-amber-600">⚠ This is outside the typical range (54–74mm). Consider re-measuring or consulting your optician.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setStep('intro'); setPd(null); setClickStep('card-left'); setCardLeft(null); setCardPixelWidth(null); setLeftPupil(null); setRightPupil(null); }}
              className="flex-1 py-3 border border-gray-200 text-sm rounded-lg hover:border-black">Re-measure</button>
            <Link href={`/account/prescriptions?pd=${pd}`} className="flex-1 py-3 bg-black text-white text-sm rounded-lg hover:bg-gray-800 text-center">Use This PD</Link>
          </div>
        </div>
      )}
    </div>
  );
}
