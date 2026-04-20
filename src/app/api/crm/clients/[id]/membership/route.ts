export const dynamic = "force-dynamic";
import { db } from '@/lib/db';
import { customersProjection, creditsLedger, auditLog } from '@/lib/db/schema';
import { requireCrmAuth } from '@/lib/crm/auth';
import { jsonOk, jsonError } from '@/lib/crm/api-response';
import { handler } from '@/lib/crm/route-handler';
import { eq, sql } from 'drizzle-orm';
import { updateCustomerMetafield } from '@/lib/crm/shopify-admin';
import { getTierFromTags, TIERS, TierKey } from '@/lib/crm/loyalty-config';

export const GET = handler(async (_request, ctx) => {
  await requireCrmAuth('org:membership:read');
  const id = ctx.params.id;

  const client = await db.select({ tags: customersProjection.tags, metafields: customersProjection.metafields })
    .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]);
  if (!client) return jsonError('Client not found', 404);

  const meta = ((client.metafields as Record<string, Record<string, string>> | null)?.custom) ?? {};
  const tier = getTierFromTags(client.tags);

  const balanceResult = await db
    .select({ total: sql<string>`coalesce(sum(${creditsLedger.amount}), 0)` })
    .from(creditsLedger).where(eq(creditsLedger.shopifyCustomerId, id));

  return jsonOk({
    tier,
    tierLabel: tier ? TIERS[tier as keyof typeof TIERS]?.label ?? null : null,
    status: meta.membership_status || (tier ? 'active' : null),
    creditBalance: Number(balanceResult[0]?.total ?? 0),
    memberSince: meta.member_since || null,
    nextRenewal: meta.next_renewal || null,
    lastRotation: meta.last_rotation_used || null,
    lastLensRefresh: meta.last_lens_refresh || null,
  });
});

export const PATCH = handler(async (request, ctx) => {
  const session = await requireCrmAuth();
  const id = ctx.params.id;
  const body = await request.json();

  const client = await db.select({ tags: customersProjection.tags })
    .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, id)).then(r => r[0]);
  if (!client) return jsonError('Client not found', 404);

  const oldTier = getTierFromTags(client.tags);

  // Tier change
  if (body.tier !== undefined) {
    await requireCrmAuth('org:membership:update_tier');
    const newTier = body.tier as TierKey | null;
    let tags = (client.tags ?? []).filter(t => !Object.values(TIERS).some(tc => tc.tag === t));
    if (newTier && TIERS[newTier as keyof typeof TIERS]) tags = [...tags, TIERS[newTier as keyof typeof TIERS].tag];

    await db.update(customersProjection).set({ tags, syncedAt: new Date() }).where(eq(customersProjection.shopifyCustomerId, id));

    await db.insert(auditLog).values({
      action: 'tag_change', entityType: 'membership', entityId: id,
      staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
      diff: { oldTier, newTier },
    });
  }

  // Status change
  if (body.status !== undefined) {
    await requireCrmAuth('org:membership:update_status');
    await updateCustomerMetafield(Number(id), 'custom', 'membership_status', body.status, 'single_line_text_field').catch(() => {});

    if (body.status === 'cancelled') {
      const grace = new Date();
      grace.setDate(grace.getDate() + 60);
      await updateCustomerMetafield(Number(id), 'custom', 'cancel_grace_ends', grace.toISOString().slice(0, 10), 'date').catch(() => {});
    }

    await db.insert(auditLog).values({
      action: 'update', entityType: 'membership', entityId: id,
      staffId: session.userId, surface: 'web', locationId: session.locationIds[0],
      diff: { status: body.status },
    });
  }

  return jsonOk({ updated: true });
});
