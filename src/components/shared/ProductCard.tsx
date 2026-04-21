'use client';

import { useState, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Product } from '@/types/shopify';
import { toSlug } from '@/lib/shopify/slug';
import FavouriteIcon from './FavouriteIcon';

export interface ProductCardLightProps {
  id: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  price: string | null;
  vendor?: string | null;
}

type ProductCardProps = {
  className?: string;
  prefetch?: boolean;
  onClick?: () => void;
} & (
  | { product: Product; light?: never }
  | { light: ProductCardLightProps; product?: never }
);

function ProductCard({ product, light, className, prefetch, onClick }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Derive common fields from either source
  // light.handle is already a slug from our APIs; product.handle is raw Shopify → toSlug it
  const handle = light ? light.slug : toSlug(product!.handle);
  const title = product?.title ?? light!.title;
  const id = product?.id ?? light!.id;

  const primaryImageUrl = product ? product.images[0]?.url : light!.imageUrl;
  const primaryAlt = product ? (product.images[0]?.altText || title) : title;
  const secondaryImageUrl = product?.images[1]?.url ?? null;
  const hasSecondImage = !!secondaryImageUrl;

  const formattedPrice = product
    ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: product.priceRange.minVariantPrice.currencyCode || 'CAD' }).format(Number(product.priceRange.minVariantPrice.amount))
    : light!.price ? `$${Number(light!.price).toFixed(0)}` : null;

  const vendor = product ? undefined : light?.vendor;

  const colorOption = product?.options.find(
    (opt) => opt.name.toLowerCase() === 'color' || opt.name.toLowerCase() === 'colour'
  );
  const colorCount = colorOption?.values.length ?? 0;
  const firstColor = colorOption?.values[0] ?? '';

  return (
    <Link
      href={`/products/${handle}`}
      prefetch={prefetch}
      onClick={onClick}
      className={`group block flex-shrink-0 ${className ?? 'w-[calc(50%-12px)] md:w-[calc(33.333%-16px)]'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="relative bg-[var(--product-card-bg,#F5F5F9)] overflow-hidden"
        style={{ aspectRatio: '463/579' }}
      >
        {product && (
          <div className="absolute top-2 right-2 z-10">
            <FavouriteIcon productId={id} />
          </div>
        )}
        {primaryImageUrl ? (
          <Image
            src={primaryImageUrl}
            alt={primaryAlt}
            fill
            className={`object-cover transition-opacity duration-500 ${
              loaded ? (isHovered && hasSecondImage ? 'opacity-0' : 'opacity-100') : 'opacity-0'
            }`}
            sizes="(max-width: 768px) 50vw, 25vw"
            onLoad={() => setLoaded(true)}
            style={{ viewTransitionName: `product-image-${handle}` }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-3xl">👓</div>
        )}
        {hasSecondImage && (
          <Image
            src={secondaryImageUrl!}
            alt={`${title} alternate`}
            fill
            className={`object-cover transition-opacity duration-300 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm leading-tight">{title}</p>
        {formattedPrice && (
          <p className="text-sm text-gray-600">
            {vendor ? `${vendor} · ` : product ? 'from ' : ''}{formattedPrice}
          </p>
        )}
        {colorCount > 0 && (
          <p className="text-xs text-gray-500">
            {colorCount} colour{colorCount !== 1 ? 's' : ''}{firstColor ? ` – ${firstColor}` : ''}
          </p>
        )}
      </div>
    </Link>
  );
}

export default memo(ProductCard, (prev, next) =>
  (prev.product?.id ?? prev.light?.id) === (next.product?.id ?? next.light?.id)
);
