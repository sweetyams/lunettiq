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
}

export default function ImageGallery({
  images,
  variants,
  selectedColour,
  productTitle,
  productHandle,
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Filter images by selected colour variant
  const filteredImages = getFilteredImages(images, variants, selectedColour);
  const displayImages = filteredImages.length > 0 ? filteredImages : images;

  // Reset index when colour changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedColour]);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < displayImages.length) {
        setCurrentIndex(index);
      }
    },
    [displayImages.length]
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : displayImages.length - 1));
  }, [displayImages.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < displayImages.length - 1 ? prev + 1 : 0));
  }, [displayImages.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (diff > threshold) goNext();
    else if (diff < -threshold) goPrev();
  }, [goNext, goPrev]);

  if (displayImages.length === 0) {
    return (
      <div
        className="relative w-full bg-[#F5F5F9] flex items-center justify-center"
        style={{ aspectRatio: '696/870' }}
      >
        <span className="text-gray-400 text-sm">No image available</span>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Main image */}
      <div
        className="relative w-full overflow-hidden bg-[#F5F5F9]"
        style={{ aspectRatio: '696/870' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="region"
        aria-label={`${productTitle} image gallery`}
        aria-roledescription="carousel"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={displayImages[currentIndex].url}
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
        </AnimatePresence>

        {/* Chevron arrows */}
        {displayImages.length > 1 && (
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

      {/* Dot indicators */}
      {displayImages.length > 1 && (
        <div className="flex justify-center gap-2 mt-4" role="tablist" aria-label="Image navigation">
          {displayImages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? 'bg-black' : 'bg-gray-300'
              }`}
              role="tab"
              aria-selected={i === currentIndex}
              aria-label={`View image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Filter images to those matching the selected colour variant.
 * Variant images are matched by URL against the full image set.
 */
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
