'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/types/shopify';
import FavouriteIcon from './FavouriteIcon';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export default function ProductCard({ product, className }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const primaryImage = product.images[0];
  const secondaryImage = product.images[1];
  const hasSecondImage = !!secondaryImage;

  // Price: use lowest variant price
  const price = product.priceRange.minVariantPrice;
  const formattedPrice = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: price.currencyCode || 'CAD',
  }).format(Number(price.amount));

  // Colour info from options
  const colorOption = product.options.find(
    (opt) => opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour'
  );
  const colorCount = colorOption?.values.length ?? 0;
  const firstColor = colorOption?.values[0] ?? '';

  return (
    <Link
      href={`/products/${product.handle}`}
      className={`group block flex-shrink-0 ${className ?? 'w-[calc(50%-12px)] md:w-[calc(25%-36px)]'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image container — aspect ratio 463:579 */}
      <div className="relative bg-[#F5F5F9] overflow-hidden" style={{ aspectRatio: '463/579' }}>
        <div className="absolute top-2 right-2 z-10">
          <FavouriteIcon productId={product.id} />
        </div>
        {primaryImage && (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText || product.title}
            fill
            className={`object-cover transition-opacity duration-300 ${
              isHovered && hasSecondImage ? 'opacity-0' : 'opacity-100'
            }`}
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        )}
        {hasSecondImage && (
          <Image
            src={secondaryImage.url}
            alt={secondaryImage.altText || `${product.title} alternate`}
            fill
            className={`object-cover transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        )}
      </div>

      {/* Product info */}
      <div className="mt-3 space-y-1">
        <p className="text-sm leading-tight">{product.title}</p>
        <p className="text-sm text-gray-600">from {formattedPrice}</p>
        {colorCount > 0 && (
          <p className="text-xs text-gray-500">
            {colorCount} colour{colorCount !== 1 ? 's' : ''}{firstColor ? ` – ${firstColor}` : ''}
          </p>
        )}
      </div>
    </Link>
  );
}
