export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { loyaltyTiers, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { sql } from 'drizzle-orm';
import { MEMBERSHIP_PRODUCT_ID, MEMBERSHIP_VARIANTS } from '@/lib/crm/membership-config';

export const GET = handler(async () => {
  await requireCrmAuth('org:reports:read');

  const tiers = await db.select().from(loyaltyTiers).orderBy(loyaltyTiers.sortOrder);

  const memberCounts = await db.execute(sql`
    SELECT
      CASE
        WHEN 'member-essential' = ANY(tags) THEN 'essential'
        WHEN 'member-cult' = ANY(tags) THEN 'cult'
        WHEN 'member-vault' = ANY(tags) THEN 'vault'
        ELSE 'none'
      END as tier,
      count(*) as count
    FROM customers_projection
    GROUP BY 1
  `);

  return jsonOk({
    tiers,
    productId: MEMBERSHIP_PRODUCT_ID,
    variants: Object.entries(MEMBERSHIP_VARIANTS).map(([sku, v]) => ({ sku, ...v })),
    memberCounts: (memberCounts.rows as any[]).reduce((acc, r) => ({ ...acc, [r.tier]: Number(r.count) }), {}),
  });
});
