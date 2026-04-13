'use client';

import { useState } from 'react';
import type { LensConfiguration } from '@/types/configurator';
import type { LensOption } from '@/types/metaobjects';
import { useCart } from '@/context/CartContext';
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
  const { addToCart, openCart } = useCart();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !isConfigComplete || isOutOfStock || !variantId || adding;

  let label = 'Add to Cart';
  if (isOutOfStock) {
    label = 'Sold Out';
  } else if (!isConfigComplete) {
    label = 'Complete configuration to add to cart';
  } else if (adding) {
    label = 'Adding…';
  }

  async function handleClick() {
    if (disabled || !variantId) return;
    setError(null);
    setAdding(true);
    try {
      const attributes = serializeConfig(lensConfiguration, lensOptions, frameBasePrice);
      await addToCart(variantId, 1, attributes);
      openCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to cart. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={`
          w-full py-3 text-sm font-medium transition-colors
          ${disabled
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-black text-white hover:bg-gray-800 cursor-pointer'
          }
        `}
        aria-disabled={disabled}
      >
        {label}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
