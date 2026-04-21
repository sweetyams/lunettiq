import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getProductByHandle } from '@/lib/shopify/queries/product';
import { db } from '@/lib/db';
import { productsProjection } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ProductClient from './ProductClient';
import { BelowFoldPDP } from './ProductClient';

export const revalidate = process.env.NODE_ENV === 'development' ? 0 : 60;

interface ProductPageProps {
  params: { handle: string };
}

/** Resolve a URL slug to the real Shopify handle via DB. Also handles old URLs by checking raw handle. */
async function resolveHandle(slug: string): Promise<{ shopifyHandle: string; canonicalSlug: string } | null> {
  // Try slug first
  const [bySlug] = await db
    .select({ handle: productsProjection.handle, slug: productsProjection.slug })
    .from(productsProjection)
    .where(eq(productsProjection.slug, slug))
    .limit(1);
  if (bySlug) return { shopifyHandle: bySlug.handle!, canonicalSlug: bySlug.slug! };

  // Fall back to raw Shopify handle (old URLs)
  const [byHandle] = await db
    .select({ handle: productsProjection.handle, slug: productsProjection.slug })
    .from(productsProjection)
    .where(eq(productsProjection.handle, slug))
    .limit(1);
  if (byHandle) return { shopifyHandle: byHandle.handle!, canonicalSlug: byHandle.slug! };

  return null;
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
  const slug = decodeURIComponent(params.handle);

  const resolved = await resolveHandle(slug);

  // Redirect old URLs (raw Shopify handles) to clean slug
  if (resolved && resolved.canonicalSlug !== slug) {
    const { redirect } = await import('next/navigation');
    redirect(`/products/${resolved.canonicalSlug}`);
  }

  const shopifyHandle = resolved?.shopifyHandle ?? slug;

  let product;
  try {
    product = await getProductByHandle(shopifyHandle);
  } catch {
    throw new Error(`Failed to load product: ${slug}`);
  }
  if (!product) notFound();

  const { getLensOptions } = await import('@/lib/shopify/queries/metaobjects');
  const lensOptions = await getLensOptions().catch(() => []);

  return (
    <>
      <ProductClient product={product} slug={resolved?.canonicalSlug ?? slug} lensOptions={lensOptions} />
      <Suspense fallback={<div className="site-container py-12 space-y-8">
        <div className="h-64 bg-[var(--product-card-bg,#F5F5F9)] animate-pulse rounded" />
        <div className="h-48 bg-[var(--product-card-bg,#F5F5F9)] animate-pulse rounded" />
      </div>}>
        <BelowFoldData productId={product.id} />
      </Suspense>
    </>
  );
}
