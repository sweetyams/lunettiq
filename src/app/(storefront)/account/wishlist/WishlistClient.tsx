'use client';

import Link from 'next/link';

interface WishlistClientProps {
  initialProductIds: string[];
}

export default function WishlistClient({ initialProductIds }: WishlistClientProps) {
  if (initialProductIds.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Your wishlist is empty.</p>
        <Link
          href="/collections/optics"
          className="inline-block px-6 py-2 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors"
        >
          Browse Eyewear
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {initialProductIds.map((productId) => (
        <div key={productId} className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500 truncate">{productId}</p>
          <Link
            href={`/products/${productId}`}
            className="text-sm text-blue-600 hover:underline mt-2 inline-block"
          >
            View Product →
          </Link>
        </div>
      ))}
    </div>
  );
}
