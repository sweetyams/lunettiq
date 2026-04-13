'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface VirtualTryOnProps {
  /** Front-facing transparent frame image, or fallback product image */
  frameImageUrl: string;
  frameName: string;
}

type Status = 'idle' | 'loading' | 'active' | 'error';

export default function VirtualTryOn({ frameImageUrl, frameName }: VirtualTryOnProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Preload the frame image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = frameImageUrl;
    frameImgRef.current = img;
  }, [frameImageUrl]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    // Lazy cleanup — only dispose if module was loaded
    import('@/lib/tryon/face-tracker').then((m) => m.dispose()).catch(() => {});
  }, []);

  const start = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');

    try {
      // Start camera and load model in parallel
      const [stream, tracker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        }),
        import('@/lib/tryon/face-tracker').then((m) => m.init().then(() => m)),
      ]);

      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const canvas = canvasRef.current!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;

      setStatus('active');

      let lastTime = -1;

      const renderLoop = () => {
        if (!streamRef.current) return;

        const now = performance.now();
        if (video.currentTime !== lastTime) {
          lastTime = video.currentTime;

          // Draw mirrored video
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          try {
            const result = tracker.detect(video, now);
            const landmarks = result.faceLandmarks?.[0];

            if (landmarks && frameImgRef.current?.complete) {
              const { LANDMARKS } = tracker;

              const leftEye = landmarks[LANDMARKS.LEFT_EYE_OUTER];
              const rightEye = landmarks[LANDMARKS.RIGHT_EYE_OUTER];
              const noseBridge = landmarks[LANDMARKS.NOSE_BRIDGE];

              // Mirror the x coordinates since we flipped the video
              const lx = (1 - leftEye.x) * canvas.width;
              const ly = leftEye.y * canvas.height;
              const rx = (1 - rightEye.x) * canvas.width;
              const ry = rightEye.y * canvas.height;
              const nx = (1 - noseBridge.x) * canvas.width;
              const ny = noseBridge.y * canvas.height;

              // Calculate glasses dimensions
              const eyeDistance = Math.hypot(rx - lx, ry - ly);
              const glassesWidth = eyeDistance * 2.1;
              const aspectRatio = frameImgRef.current.naturalHeight / frameImgRef.current.naturalWidth;
              const glassesHeight = glassesWidth * aspectRatio;

              // Rotation angle from eye line
              const angle = Math.atan2(ry - ly, rx - lx);

              // Position centered on nose bridge, shifted up slightly
              const cx = nx;
              const cy = ny - glassesHeight * 0.1;

              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(angle);
              ctx.drawImage(
                frameImgRef.current,
                -glassesWidth / 2,
                -glassesHeight / 2,
                glassesWidth,
                glassesHeight
              );
              ctx.restore();
            }
          } catch {
            // Skip frame on detection error
          }
        }

        rafRef.current = requestAnimationFrame(renderLoop);
      };

      rafRef.current = requestAnimationFrame(renderLoop);
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera permissions.'
          : 'Failed to start try-on. Please try again.'
      );
    }
  }, []);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <h3 className="text-sm font-semibold">Virtual Try-On</h3>
        {status === 'active' ? (
          <button
            onClick={stop}
            className="text-xs px-3 py-1.5 border border-black rounded-full hover:bg-black hover:text-white transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={start}
            disabled={status === 'loading'}
            className="text-xs px-3 py-1.5 border border-black rounded-full hover:bg-black hover:text-white transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Loading…' : 'Try On'}
          </button>
        )}
      </div>

      {status === 'error' && (
        <p className="px-4 py-2 text-xs text-red-600">{errorMsg}</p>
      )}

      {/* Hidden video element for MediaPipe input */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Canvas output — visible when active or loading */}
      <canvas
        ref={canvasRef}
        className={`w-full aspect-[4/3] bg-black ${status === 'active' || status === 'loading' ? 'block' : 'hidden'}`}
      />

      {/* Idle state */}
      {status === 'idle' && (
        <div className="flex items-center justify-center aspect-[4/3] bg-[#F5F5F9]">
          <div className="text-center px-4">
            <svg className="mx-auto mb-2 text-gray-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p className="text-xs text-gray-500">
              See how <span className="font-medium text-black">{frameName}</span> looks on you
            </p>
            <p className="text-[10px] text-gray-400 mt-1">Uses your camera · Nothing is recorded or stored</p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center text-white">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading face detection…</p>
          </div>
        </div>
      )}
    </div>
  );
}
