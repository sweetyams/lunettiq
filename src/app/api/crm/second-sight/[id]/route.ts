export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { secondSightIntakes, customersProjection, creditsLedger, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';
import { calculateTradeInCredit } from '@/lib/crm/second-sight-rates';
import { getCreditBalance } from '@/lib/crm/points';
import { issuePoints } from '@/lib/crm/points';

export const GET = handler(async (_req, ctx) => {
  await requireCrmAuth('org:second_sight:read');
  const intake = await db.select().from(secondSightIntakes).where(eq(secondSightIntakes.id, ctx.params.id)).then(r => r[0]);
  if (!intake) return jsonError('Not found', 404);

  // Get customer tier for rate preview
  const client = await db.select({ tags: customersProjection.tags }).from(customersProjection)
    .where(eq(customersProjection.shopifyCustomerId, intake.shopifyCustomerId)).then(r => r[0]);

  return jsonOk({ intake, customerTags: client?.tags ?? [] });
});

// PATCH — grade an intake and calculate credit
export const PATCH = handler(async (req, ctx) => {
  const session = await requireCrmAuth('org:second_sight:approve_grade');
  const id = ctx.params.id;
  const { grade, frameMsrp, donate } = await req.json();

  if (!grade || !frameMsrp) return jsonError('grade and frameMsrp required', 400);

  const intake = await db.select().from(secondSightIntakes).where(eq(secondSightIntakes.id, id)).then(r => r[0]);
  if (!intake) return jsonError('Not found', 404);

  const client = await db.select({ tags: customersProjection.tags }).from(customersProjection)
    .where(eq(customersProjection.shopifyCustomerId, intake.shopifyCustomerId)).then(r => r[0]);

  // Calculate credit using tier-based rates
  const result = await calculateTradeInCredit({ frameMsrp: Number(frameMsrp), grade, customerTags: client?.tags ?? null });

  // Grade C donation option: 100 points instead of recycling credit
  const isDonation = grade === 'C' && donate;

  // Update intake
  await db.update(secondSightIntakes).set({
    grade, status: 'graded',
    creditAmount: isDonation ? '0' : String(result.credit),
    gradedBy: session.userId, gradedAt: new Date(), updatedAt: new Date(),
  }).where(eq(secondSightIntakes.id, id));

  // Issue credit or points
  if (isDonation) {
    await issuePoints({ customerId: intake.shopifyCustomerId, amount: 100, type: 'points_issued_purchase', reason: 'Second Sight C-grade donation (100 pts)' });
  } else if (result.credit > 0) {
    const balance = await getCreditBalance(intake.shopifyCustomerId);
    await db.insert(creditsLedger).values({
      shopifyCustomerId: intake.shopifyCustomerId, currency: 'credit',
      transactionType: 'issued_second_sight', amount: String(result.credit),
      runningBalance: String(balance + result.credit),
      reason: `Second Sight Grade ${grade} — $${result.credit} (${(result.rate * 100).toFixed(0)}% × ${(result.gradeMultiplier * 100).toFixed(0)}% of $${frameMsrp})`,
      relatedIntakeId: id, staffId: session.userId, locationId: session.locationIds[0],
    });

    // Mark as credited
    await db.update(secondSightIntakes).set({ status: 'credited', updatedAt: new Date() }).where(eq(secondSightIntakes.id, id));
  }

  await db.insert(auditLog).values({
    action: 'update', entityType: 'second_sight_intake', entityId: id,
    staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
    diff: { grade, frameMsrp, credit: result.credit, rate: result.rate, tier: result.tier, donate: isDonation },
  });

  return jsonOk({ ...result, isDonation, credited: !isDonation && result.credit > 0 });
});
