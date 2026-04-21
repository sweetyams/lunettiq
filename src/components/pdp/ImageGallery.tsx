'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { Image as ShopifyImage, ProductVariant } from '@/types/shopify';

interface ImageGalleryProps {
  images: ShopifyImage[];
  variants: ProductVariant[];
  selectedColour: string | null;
  productTitle: string;
  productHandle?: string;
  tryOnImageUrl?: string;
}

type TryOnStatus = 'idle' | 'loading' | 'active' | 'error';

export default function ImageGallery({
  images,
  variants,
  selectedColour,
  productTitle,
  productHandle,
  tryOnImageUrl,
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Try-on state
  const [tryOnStatus, setTryOnStatus] = useState<TryOnStatus>('idle');
  const [tryOnError, setTryOnError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const filteredImages = getFilteredImages(images, variants, selectedColour);
  const displayImages = filteredImages.length > 0 ? filteredImages : images;

  // The try-on slide is the last slide (only if tryOnImageUrl is provided)
  const hasTryOn = !!tryOnImageUrl;
  const totalSlides = displayImages.length + (hasTryOn ? 1 : 0);
  const tryOnSlideIndex = hasTryOn ? displayImages.length : -1;
  const isTryOnSlide = currentIndex === tryOnSlideIndex;

  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedColour]);

  // Preload frame image
  useEffect(() => {
    if (!tryOnImageUrl) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = tryOnImageUrl;
    frameImgRef.current = img;
  }, [tryOnImageUrl]);

  // Cleanup camera on unmount or when leaving try-on slide
  useEffect(() => {
    if (!isTryOnSlide && tryOnStatus === 'active') stopTryOn();
  }, [isTryOnSlide]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    import('@/lib/tryon/face-tracker').then((m) => m.dispose()).catch(() => {});
  }, []);

  const stopTryOn = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTryOnStatus('idle');
  }, []);

  const startTryOn = useCallback(async () => {
    setTryOnStatus('loading');
    setTryOnError('');
    try {
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

      setTryOnStatus('active');
      let lastTime = -1;

      const renderLoop = () => {
        if (!streamRef.current) return;
        const now = performance.now();
        if (video.currentTime !== lastTime) {
          lastTime = video.currentTime;
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
              const lx = (1 - landmarks[LANDMARKS.LEFT_EYE_OUTER].x) * canvas.width;
              const ly = landmarks[LANDMARKS.LEFT_EYE_OUTER].y * canvas.height;
              const rx = (1 - landmarks[LANDMARKS.RIGHT_EYE_OUTER].x) * canvas.width;
              const ry = landmarks[LANDMARKS.RIGHT_EYE_OUTER].y * canvas.height;
              const nx = (1 - landmarks[LANDMARKS.NOSE_BRIDGE].x) * canvas.width;
              const ny = landmarks[LANDMARKS.NOSE_BRIDGE].y * canvas.height;

              const eyeDistance = Math.hypot(rx - lx, ry - ly);
              const glassesWidth = eyeDistance * 2.1;
              const aspectRatio = frameImgRef.current.naturalHeight / frameImgRef.current.naturalWidth;
              const glassesHeight = glassesWidth * aspectRatio;
              const angle = Math.atan2(ry - ly, rx - lx);
              const cx = nx;
              const cy = ny;

              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(angle);
              ctx.scale(1, -1);
              ctx.drawImage(frameImgRef.current, -glassesWidth / 2, -glassesHeight / 2, glassesWidth, glassesHeight);
              ctx.restore();
            }
          } catch { /* skip frame */ }
        }
        rafRef.current = requestAnimationFrame(renderLoop);
      };
      rafRef.current = requestAnimationFrame(renderLoop);
    } catch (err) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setTryOnStatus('error');
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setTryOnError('Camera access denied. Please allow camera permissions.');
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        setTryOnError('No camera found on this device.');
      } else {
        setTryOnError(`Try-on failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, []);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < totalSlides) setCurrentIndex(index);
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalSlides - 1));
  }, [totalSlides]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : 0));
  }, [totalSlides]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 50) goNext();
    else if (diff < -50) goPrev();
  }, [goNext, goPrev]);

  if (displayImages.length === 0) {
    return (
      <div className="relative w-full bg-[var(--product-card-bg,#F5F5F9)] flex items-center justify-center" style={{ aspectRatio: '696/870' }}>
        <span className="text-gray-400 text-sm">No image available</span>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Main slide area */}
      <div
        className="relative w-full overflow-hidden bg-[var(--product-card-bg,#F5F5F9)]"
        style={{ aspectRatio: '696/870' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="region"
        aria-label={`${productTitle} image gallery`}
        aria-roledescription="carousel"
      >
        <AnimatePresence mode="wait">
          {isTryOnSlide ? (
            <motion.div
              key="tryon-slide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              {/* Hidden video for MediaPipe */}
              <video ref={videoRef} className="hidden" playsInline muted />

              {/* Camera canvas */}
              <canvas
                ref={canvasRef}
                className={`w-full h-full object-cover bg-black ${tryOnStatus === 'active' || tryOnStatus === 'loading' ? 'block' : 'hidden'}`}
              />

              {/* Idle / error state */}
              {(tryOnStatus === 'idle' || tryOnStatus === 'error') && (
                <div className="flex flex-col items-center justify-center h-full px-4">
                  <svg className="mb-3 text-gray-400" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <p className="text-sm text-gray-600 mb-1">
                    See how <span className="font-medium text-black">{productTitle}</span> looks on you
                  </p>
                  <p className="text-[10px] text-gray-400 mb-4">Uses your camera · Nothing is recorded</p>
                  {tryOnStatus === 'error' && (
                    <p className="text-xs text-red-600 mb-3">{tryOnError}</p>
                  )}
                  <button
                    onClick={startTryOn}
                    className="text-xs px-4 py-2 border border-black rounded-full hover:bg-black hover:text-white transition-colors"
                  >
                    Launch Camera
                  </button>
                </div>
              )}

              {/* Loading overlay */}
              {tryOnStatus === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="text-center text-white">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading face detection…</p>
                  </div>
                </div>
              )}

              {/* Stop button when active */}
              {tryOnStatus === 'active' && (
                <button
                  onClick={stopTryOn}
                  className="absolute top-3 right-3 text-xs px-3 py-1.5 bg-white/80 hover:bg-white border border-black rounded-full transition-colors"
                >
                  Stop
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={displayImages[currentIndex]?.url}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              <Image
                src={displayImages[currentIndex].url}
                alt={displayImages[currentIndex].altText || `${productTitle} image ${currentIndex + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={currentIndex === 0}
                style={currentIndex === 0 && productHandle ? { viewTransitionName: `product-image-${productHandle}` } : undefined}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chevron arrows */}
        {totalSlides > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-colors"
              aria-label="Previous image"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-colors"
              aria-label="Next image"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Text beneath image: "Try on" link or dot indicators */}
      <div className="flex items-center justify-between mt-4">
        {/* Dot indicators */}
        {totalSlides > 1 && (
          <div className="flex gap-2" role="tablist" aria-label="Image navigation">
            {Array.from({ length: totalSlides }, (_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-black' : 'bg-gray-300'}`}
                role="tab"
                aria-selected={i === currentIndex}
                aria-label={i === tryOnSlideIndex ? 'Virtual try-on' : `View image ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Try-on launch text */}
        {hasTryOn && !isTryOnSlide && (
          <button
            onClick={() => goTo(tryOnSlideIndex)}
            className="text-xs text-gray-500 hover:text-black transition-colors underline underline-offset-2"
          >
            Virtual Try-On →
          </button>
        )}
        {hasTryOn && isTryOnSlide && tryOnStatus === 'active' && (
          <button
            onClick={stopTryOn}
            className="text-xs text-gray-500 hover:text-black transition-colors underline underline-offset-2"
          >
            Stop Try-On
          </button>
        )}
      </div>
    </div>
  );
}

function getFilteredImages(
  allImages: ShopifyImage[],
  variants: ProductVariant[],
  selectedColour: string | null
): ShopifyImage[] {
  if (!selectedColour) return allImages;

  const colourVariants = variants.filter((v) =>
    v.selectedOptions.some(
      (opt) =>
        (opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour') &&
        opt.value.toLowerCase() === selectedColour.toLowerCase()
    )
  );

  if (colourVariants.length === 0) return allImages;

  const variantImageUrls = new Set(
    colourVariants.map((v) => v.image?.url).filter(Boolean)
  );

  if (variantImageUrls.size === 0) return allImages;

  const filtered = allImages.filter((img) => variantImageUrls.has(img.url));
  return filtered.length > 0 ? filtered : allImages;
}
