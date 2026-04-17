import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getProductByHandle } from '@/lib/shopify/queries/product';
import ProductClient from './ProductClient';
import { BelowFoldPDP } from './ProductClient';

export const revalidate = process.env.NODE_ENV === 'development' ? 0 : 60;

interface ProductPageProps {
  params: { handle: string };
}

async function BelowFoldData({ productId }: { productId: string }) {
  const { getProductRecommendations } = await import('@/lib/shopify/queries/product');
  const { getEyeTestCTAs } = await import('@/lib/shopify/queries/metaobjects');

  const [recommendations, eyeTestCTAs] = await Promise.all([
    getProductRecommendations(productId).catch(() => []),
    getEyeTestCTAs().catch(() => []),
  ]);

  return <BelowFoldPDP recommendations={recommendations} eyeTestCTAs={eyeTestCTAs} />;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const handle = decodeURIComponent(params.handle);

  try {
    const product = await getProductByHandle(handle);
    if (!product) notFound();

    const { getLensOptions } = await import('@/lib/shopify/queries/metaobjects');
    const lensOptions = await getLensOptions().catch(() => []);

    return (
      <>
        <ProductClient product={product} lensOptions={lensOptions} />
        <Suspense fallback={<div className="px-4 md:px-8 py-12 space-y-8">
          <div className="h-64 bg-[#F5F5F9] animate-pulse rounded" />
          <div className="h-48 bg-[#F5F5F9] animate-pulse rounded" />
        </div>}>
          <BelowFoldData productId={product.id} />
        </Suspense>
      </>
    );
  } catch (error) {
    console.error('Product page error:', error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6">
        <p className="text-lg text-gray-600 mb-4">Unable to load product. Please try again.</p>
        <a
          href={`/products/${handle}`}
          className="px-6 py-2 border border-black text-sm hover:bg-black hover:text-white transition-colors"
        >
          Retry
        </a>
      </div>
    );
  }
}
