'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useCartDrawer } from '@/context/CartDrawerContext';
import type { CartLineItem } from '@/types/shopify';

/* ------------------------------------------------------------------ */
/*  Config attribute display helper                                    */
/* ------------------------------------------------------------------ */

const CONFIG_LABELS: Record<string, string> = {
  _lensType: 'Lens Type',
  _lensIndex: 'Material',
  _coatings: 'Coatings',
  _sunTint: 'Tint',
  _polarized: 'Polarized',
  _mirrorCoating: 'Mirror',
  _rxStatus: 'Prescription',
};

function formatAttrValue(key: string, value: string): string | null {
  if (!value || value === 'false' || value === 'none') return null;
  if (key === '_polarized') return value === 'true' ? 'Yes' : null;
  if (key === '_coatings') return value.split(',').join(', ');
  return value;
}

function ConfigSummaryLine({ item }: { item: CartLineItem }) {
  const configAttrs = item.attributes.filter(
    (a) => a.key.startsWith('_') && !a.key.startsWith('_rx') && !a.key.endsWith('Price')
  );
  const displayable = configAttrs
    .map((a) => ({ label: CONFIG_LABELS[a.key] ?? a.key, value: formatAttrValue(a.key, a.value) }))
    .filter((d) => d.value !== null);

  if (displayable.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {displayable.map((d) => (
        <p key={d.label} className="text-[11px] text-gray-500">
          {d.label}: {d.value}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Line Item component                                                */
/* ------------------------------------------------------------------ */

function LineItem({
  item,
  onQuantityChange,
  onRemove,
  isLoading,
}: {
  item: CartLineItem;
  onQuantityChange: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  isLoading: boolean;
}) {
  const variant = item.merchandise;
  const imageUrl = variant.image?.url;
  const variantInfo = variant.selectedOptions.map((o) => o.value).join(' / ');
  const linePrice = parseFloat(item.cost.totalAmount.amount);

  return (
    <div className="flex gap-3 py-4 border-b border-gray-100">
      {/* Image */}
      <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded overflow-hidden relative">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={variant.title}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            No image
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{variant.title}</p>
        {variantInfo && (
          <p className="text-xs text-gray-500">{variantInfo}</p>
        )}
        <ConfigSummaryLine item={item} />

        {/* Quantity stepper */}
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            disabled={isLoading || item.quantity <= 1}
            onClick={() => onQuantityChange(item.id, item.quantity - 1)}
            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded text-sm disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="text-sm w-6 text-center">{item.quantity}</span>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onQuantityChange(item.id, item.quantity + 1)}
            className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded text-sm disabled:opacity-40"
            aria-label="Increase quantity"
          >
            +
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onRemove(item.id)}
            className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
            aria-label="Remove item"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="text-sm font-medium whitespace-nowrap">
        ${linePrice.toFixed(2)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CartDrawer                                                         */
/* ------------------------------------------------------------------ */

export default function CartDrawer() {
  const {
    cart,
    isLoading,
    updateLineItem,
    removeLineItem,
  } = useCart();
  const { isOpen, closeCart } = useCartDrawer();

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) closeCart();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeCart]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeCart();
      }
    },
    [closeCart]
  );

  const handleQuantityChange = useCallback(
    (lineId: string, qty: number) => {
      if (qty < 1) return;
      updateLineItem(lineId, qty);
    },
    [updateLineItem]
  );

  const handleRemove = useCallback(
    (lineId: string) => {
      removeLineItem(lineId);
    },
    [removeLineItem]
  );

  const handleCheckout = useCallback(() => {
    if (cart?.checkoutUrl) {
      window.location.href = cart.checkoutUrl;
    }
  }, [cart]);

  const lines = cart?.lines ?? [];
  const subtotal = cart ? parseFloat(cart.cost.subtotalAmount.amount) : 0;
  const currency = cart?.cost.subtotalAmount.currencyCode ?? 'CAD';
  const isEmpty = lines.length === 0;

  // Animated subtotal
  const [displaySubtotal, setDisplaySubtotal] = useState(subtotal);
  const prevSubtotal = useRef(subtotal);
  useEffect(() => {
    if (prevSubtotal.current === subtotal) return;
    const from = prevSubtotal.current;
    const diff = subtotal - from;
    const duration = 300;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      setDisplaySubtotal(from + diff * progress);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    prevSubtotal.current = subtotal;
  }, [subtotal]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`
          fixed inset-0 z-50 bg-black/40 transition-opacity duration-300
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={handleOverlayClick}
        aria-hidden={!isOpen}
      >
        {/* Panel */}
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Shopping cart"
          aria-modal="true"
          className={`
            absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl
            flex flex-col transition-transform duration-300 ease-in-out
            ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold">
              Your Cart {!isEmpty && `(${lines.reduce((s, l) => s + l.quantity, 0)})`}
            </h2>
            <button
              type="button"
              onClick={closeCart}
              className="p-1 text-gray-500 hover:text-black transition-colors"
              aria-label="Close cart"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-sm text-gray-500 mb-4">Your cart is empty</p>
                <Link
                  href="/collections/all"
                  onClick={closeCart}
                  className="text-sm font-medium text-black underline hover:no-underline"
                >
                  Continue shopping
                </Link>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {lines.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <LineItem
                      item={item}
                      onQuantityChange={handleQuantityChange}
                      onRemove={handleRemove}
                      isLoading={isLoading}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Footer */}
          {!isEmpty && (
            <div className="border-t border-gray-200 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">
                  ${displaySubtotal.toFixed(2)} {currency}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isLoading}
                className="w-full py-3 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Proceed to Checkout
              </button>
              <button
                type="button"
                onClick={closeCart}
                className="w-full text-center text-sm text-gray-500 hover:text-black transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
