import { notFound } from 'next/navigation';
import { getProductByHandle, getProductRecommendations } from '@/lib/shopify/queries/product';
import { getEyeTestCTAs, getLensOptions } from '@/lib/shopify/queries/metaobjects';
import ProductClient from './ProductClient';

export const revalidate = 60;

interface ProductPageProps {
  params: { handle: string };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const handle = decodeURIComponent(params.handle);

  try {
    const product = await getProductByHandle(handle);

    if (!product) {
      notFound();
    }

    const [recommendations, eyeTestCTAs, lensOptions] = await Promise.all([
      getProductRecommendations(product.id).catch(() => []),
      getEyeTestCTAs().catch(() => []),
      getLensOptions().catch(() => []),
    ]);

    return (
      <ProductClient
        product={product}
        recommendations={recommendations}
        eyeTestCTAs={eyeTestCTAs}
        lensOptions={lensOptions}
      />
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
