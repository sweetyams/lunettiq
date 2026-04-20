export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { productsProjection, productVariantsProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq } from 'drizzle-orm';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:products:read');
  const id = ctx.params.id;

  const [product, variants] = await Promise.all([
    db.select().from(productsProjection).where(eq(productsProjection.shopifyProductId, id)).then(r => r[0]),
    db.select().from(productVariantsProjection).where(eq(productVariantsProjection.shopifyProductId, id)),
  ]);

  if (!product) return jsonError('Product not found', 404);

  const imgs = (product.images ?? []) as Array<string | { src?: string }>;
  const imageUrl = typeof imgs[0] === 'string' ? imgs[0] : imgs[0]?.src ?? null;

  return jsonOk({
    ...product,
    imageUrl,
    variants: variants.map(v => ({
      ...v,
      totalInventory: v.inventoryQuantity ?? 0,
    })),
  });
});
