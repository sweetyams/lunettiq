'use client';

import type { Product, ProductVariant } from '@/types/shopify';
import DualPriceDisplay from './DualPriceDisplay';
import FavouriteIcon from '@/components/shared/FavouriteIcon';

interface ProductInfoPanelProps {
  product: Product;
  selectedVariant: ProductVariant | null;
}

export default function ProductInfoPanel({
  product,
  selectedVariant,
}: ProductInfoPanelProps) {
  // Use selected variant price, fallback to min variant price
  const price = selectedVariant?.price ?? product.priceRange.minVariantPrice;
  const formattedPrice = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: price.currencyCode || 'CAD',
  }).format(Number(price.amount));

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-light tracking-wide">{product.title}</h1>
        <FavouriteIcon productId={product.id} />
      </div>

      <DualPriceDisplay price={Number(price.amount)} currencyCode={price.currencyCode || 'CAD'} />

      {/* Early access badge */}
      {product.tags?.some((t: string) => t.startsWith('early-access-')) && (
        <div className="mt-2 inline-block px-2 py-0.5 bg-black text-white text-xs font-medium uppercase tracking-wider rounded">
          {product.tags.find((t: string) => t.startsWith('early-access-'))?.replace('early-access-', '').toUpperCase()} Early Access
        </div>
      )}

      {product.description && (
        <div
          className="mt-4 text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: product.descriptionHtml || product.description }}
        />
      )}
    </div>
  );
}
