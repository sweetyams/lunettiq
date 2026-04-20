export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { referrals, customersProjection } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, desc } from 'drizzle-orm';

export const GET = handler(async () => {
  await requireCrmAuth('org:membership:read');
  const rows = await db.select({
    referral: referrals,
    referrerFirst: customersProjection.firstName,
    referrerLast: customersProjection.lastName,
  }).from(referrals)
    .leftJoin(customersProjection, eq(referrals.referrerCustomerId, customersProjection.shopifyCustomerId))
    .orderBy(desc(referrals.createdAt)).limit(200);

  return jsonOk(rows.map(r => ({
    ...r.referral,
    referrerName: [r.referrerFirst, r.referrerLast].filter(Boolean).join(' ') || null,
  })));
});
