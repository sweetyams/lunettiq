export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { inventoryAdjustments } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, and, desc } from 'drizzle-orm';

export const GET = handler(async (request) => {
  await requireCrmAuth('org:products:read');
  const p = request.nextUrl.searchParams;
  const conditions = [];
  if (p.get('familyId')) conditions.push(eq(inventoryAdjustments.familyId, p.get('familyId')!));
  if (p.get('colour')) conditions.push(eq(inventoryAdjustments.colour, p.get('colour')!));
  if (p.get('variantId')) conditions.push(eq(inventoryAdjustments.variantId, p.get('variantId')!));
  if (p.get('locationId')) conditions.push(eq(inventoryAdjustments.locationId, p.get('locationId')!));

  const rows = await db.select().from(inventoryAdjustments)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(inventoryAdjustments.createdAt))
    .limit(100);

  return jsonOk(rows);
});
