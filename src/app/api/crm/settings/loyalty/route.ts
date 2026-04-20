export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { loyaltyTiers } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, asc } from 'drizzle-orm';
import { invalidateTierCache } from '@/lib/crm/loyalty-config';

export const GET = handler(async () => {
  await requireCrmAuth();
  const rows = await db.select().from(loyaltyTiers).orderBy(asc(loyaltyTiers.sortOrder));
  return jsonOk(rows);
});

export const POST = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const body = await req.json();
  if (!body.id || !body.label || !body.tag) return jsonError('id, label, tag required', 400);
  const [row] = await db.insert(loyaltyTiers).values({
    id: body.id,
    label: body.label,
    tag: body.tag,
    monthlyCredit: body.monthlyCredit ?? '0',
    birthdayCredit: body.birthdayCredit ?? '20',
    tradeInRate: body.tradeInRate ?? '0',
    lensRefresh: body.lensRefresh ?? false,
    frameRotation: body.frameRotation ?? null,
    sortOrder: body.sortOrder ?? 0,
    monthlyFee: body.monthlyFee ?? null,
    annualFee: body.annualFee ?? null,
    secondSightRate: body.secondSightRate ?? null,
    earlyAccessHours: body.earlyAccessHours ?? 0,
    namedOptician: body.namedOptician ?? false,
    freeRepairs: body.freeRepairs ?? null,
    styleConsultation: body.styleConsultation ?? null,
    eventsPerYear: body.eventsPerYear ?? 0,
    annualGift: body.annualGift ?? false,
    archiveVote: body.archiveVote ?? false,
    privateWhatsapp: body.privateWhatsapp ?? false,
    shippingTier: body.shippingTier ?? null,
    referralRewardCredit: body.referralRewardCredit ?? null,
    referralExtensionMonths: body.referralExtensionMonths ?? 0,
    referredDiscount: body.referredDiscount ?? null,
    referredTrialTier: body.referredTrialTier ?? null,
  }).returning();
  invalidateTierCache();
  return jsonOk(row, 201);
});

export const PUT = handler(async (req) => {
  await requireCrmAuth('org:settings:business_config');
  const body = await req.json();
  if (!body.id) return jsonError('id required', 400);
  const [row] = await db.update(loyaltyTiers).set({
    label: body.label,
    tag: body.tag,
    monthlyCredit: body.monthlyCredit,
    birthdayCredit: body.birthdayCredit,
    tradeInRate: body.tradeInRate,
    lensRefresh: body.lensRefresh,
    frameRotation: body.frameRotation,
    sortOrder: body.sortOrder,
    active: body.active,
    monthlyFee: body.monthlyFee,
    annualFee: body.annualFee,
    secondSightRate: body.secondSightRate,
    earlyAccessHours: body.earlyAccessHours,
    namedOptician: body.namedOptician,
    freeRepairs: body.freeRepairs,
    styleConsultation: body.styleConsultation,
    eventsPerYear: body.eventsPerYear,
    annualGift: body.annualGift,
    archiveVote: body.archiveVote,
    privateWhatsapp: body.privateWhatsapp,
    shippingTier: body.shippingTier,
    referralRewardCredit: body.referralRewardCredit,
    referralExtensionMonths: body.referralExtensionMonths,
    referredDiscount: body.referredDiscount,
    referredTrialTier: body.referredTrialTier,
  }).where(eq(loyaltyTiers.id, body.id)).returning();
  if (!row) return jsonError('Not found', 404);
  invalidateTierCache();
  return jsonOk(row);
});
