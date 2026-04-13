'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useCartDrawer } from '@/context/CartDrawerContext';
import type { LensConfiguration } from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';
import { serializeConfig } from '@/lib/configurator/serialize';

interface AddToCartButtonProps {
  variantId: string | null;
  isConfigComplete: boolean;
  isOutOfStock: boolean;
  lensConfiguration: LensConfiguration;
  lensOptions: LensOption[];
  frameBasePrice: number;
}

export default function AddToCartButton({
  variantId,
  isConfigComplete,
  isOutOfStock,
  lensConfiguration,
  lensOptions,
  frameBasePrice,
}: AddToCartButtonProps) {
  const { addToCart } = useCart();
  const { openCart } = useCartDrawer();
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !isConfigComplete || isOutOfStock || !variantId || adding;

  let label = 'Add to Cart';
  if (isOutOfStock) label = 'Sold Out';
  else if (!isConfigComplete) label = 'Complete configuration to add to cart';
  else if (adding) label = 'Adding…';

  const handleClick = useCallback(async () => {
    if (disabled || !variantId) return;
    setError(null);
    setAdding(true);
    try {
      const attributes = serializeConfig(lensConfiguration, lensOptions, frameBasePrice);
      await addToCart(variantId, 1, attributes);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        openCart();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to cart. Please try again.');
    } finally {
      setAdding(false);
    }
  }, [disabled, variantId, lensConfiguration, lensOptions, frameBasePrice, addToCart, openCart]);

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={`
          relative w-full py-3 text-sm font-medium transition-colors overflow-hidden
          ${disabled
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : success
              ? 'bg-green-600 text-white'
              : 'bg-black text-white hover:bg-gray-800 cursor-pointer'
          }
        `}
        aria-disabled={disabled}
      >
        <AnimatePresence mode="wait">
          {success ? (
            <motion.span
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Added
            </motion.span>
          ) : (
            <motion.span
              key="label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}
