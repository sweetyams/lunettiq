'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';

interface VirtualTryOnProps {
  frameImageUrl: string;
  frameName: string;
}

export default function VirtualTryOn({ frameImageUrl, frameName }: VirtualTryOnProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 50, y: 35, scale: 1 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setActive(true);
        setError(null);
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions to try on frames.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setPosition((p) => ({
      ...p,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    }));
  }, []);

  const handlePointerUp = useCallback(() => { dragging.current = false; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setPosition((p) => ({ ...p, scale: Math.max(0.3, Math.min(3, p.scale - e.deltaY * 0.002)) }));
  }, []);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <h3 className="text-sm font-semibold">Virtual Try-On</h3>
        <button
          onClick={active ? stopCamera : startCamera}
          className="text-xs px-3 py-1.5 border border-black rounded-full hover:bg-black hover:text-white transition-colors"
        >
          {active ? 'Stop Camera' : 'Try On'}
        </button>
      </div>

      {error && <p className="px-4 py-2 text-xs text-red-600">{error}</p>}

      <div
        className="relative bg-black aspect-[4/3] overflow-hidden"
        style={{ display: active || error ? 'block' : 'none' }}
        onWheel={handleWheel}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        {active && (
          <div
            className="absolute cursor-grab active:cursor-grabbing select-none"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: `translate(-50%, -50%) scale(${position.scale})`,
              width: '60%',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <Image
              src={frameImageUrl}
              alt={`Try on ${frameName}`}
              width={400}
              height={160}
              className="w-full h-auto opacity-85 drop-shadow-lg pointer-events-none"
              draggable={false}
            />
          </div>
        )}
      </div>

      {!active && !error && (
        <div className="flex items-center justify-center aspect-[4/3] bg-[#F5F5F9]">
          <div className="text-center">
            <svg className="mx-auto mb-2 text-gray-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p className="text-xs text-gray-500">Use your camera to try on this frame</p>
            <p className="text-[10px] text-gray-400 mt-1">Drag to position · Scroll to resize</p>
          </div>
        </div>
      )}
    </div>
  );
}
