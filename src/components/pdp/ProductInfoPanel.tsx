'use client';

import type { Product, ProductVariant } from '@/types/shopify';

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
      <h1 className="text-2xl md:text-3xl font-light tracking-wide">
        {product.title}
      </h1>

      <p className="mt-2 text-lg text-gray-700">{formattedPrice}</p>

      {product.description && (
        <div
          className="mt-4 text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: product.descriptionHtml || product.description }}
        />
      )}
    </div>
  );
}
