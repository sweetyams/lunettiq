import { db } from '@/lib/db';
import { productsProjection, productVariantsProjection } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ProductDetailClient } from './ProductDetailClient';
import { requirePermission } from '@/lib/crm/auth';

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  await requirePermission('org:products:read');
  const [product, variants] = await Promise.all([
    db.select().from(productsProjection).where(eq(productsProjection.shopifyProductId, params.id)).then(r => r[0]),
    db.select().from(productVariantsProjection).where(eq(productVariantsProjection.shopifyProductId, params.id)),
  ]);

  if (!product) notFound();

  return (
    <ProductDetailClient
      product={JSON.parse(JSON.stringify(product))}
      variants={JSON.parse(JSON.stringify(variants))}
    />
  );
}
