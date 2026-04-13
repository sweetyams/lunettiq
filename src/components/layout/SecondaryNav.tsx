'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useCartDrawer } from '@/context/CartDrawerContext';

export default function SecondaryNav() {
  const { cart } = useCart();
  const { openCart } = useCartDrawer();
  const cartCount = cart?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  return (
    <nav className="flex items-center gap-4" aria-label="Secondary navigation">
      {/* Search */}
      <button
        type="button"
        aria-label="Search"
        className="text-gray-700 transition-colors hover:text-black"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>

      {/* Our Stores */}
      <Link
        href="/pages/stores"
        className="text-sm font-medium text-gray-700 transition-colors hover:text-black"
      >
        Our Stores
      </Link>

      {/* Account */}
      <Link
        href="/account"
        aria-label="Account"
        className="text-gray-700 transition-colors hover:text-black"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </Link>

      {/* Cart */}
      <button
        type="button"
        onClick={openCart}
        aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}
        className="relative text-gray-700 transition-colors hover:text-black"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
        {cartCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
            {cartCount}
          </span>
        )}
      </button>

      {/* Stylist Appointment CTA */}
      <Link
        href="/pages/stylist-appointment"
        className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Stylist Appointment
      </Link>
    </nav>
  );
}
