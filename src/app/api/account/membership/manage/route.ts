export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customersProjection, auditLog } from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { eq } from 'drizzle-orm';
import { getTierFromTags, TIERS } from '@/lib/crm/loyalty-config';
import { updateCustomerMetafield, addCustomerTag, removeCustomerTag } from '@/lib/crm/shopify-admin';
import { getCustomerSubscriptions, updateSubscriptionVariant, cancelSubscription, pauseSubscription, activateSubscription, getVariantForChange } from '@/lib/crm/subscriptions';
import { isIntegrationEnabled } from '@/lib/crm/integrations';

async function getCustomerId() {
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) return process.env.DEV_CUSTOMER_ID;
  const token = getAccessToken();
  if (!token) return null;
  return (await getCustomerProfile(token)).id.replace(/^gid:\/\/shopify\/Customer\//, '');
}

export async function POST(request: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action, newTier } = body;

  const client = await db.select({ tags: customersProjection.tags, metafields: customersProjection.metafields })
    .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const currentTier = getTierFromTags(client.tags);
  const mf = (client.metafields ?? {}) as any;

  // Try to use Shopify Subscriptions if available
  const hasSubscriptions = await isIntegrationEnabled('shopify');
  let subscription: any = null;
  if (hasSubscriptions && currentTier) {
    try {
      const subs = await getCustomerSubscriptions(customerId);
      subscription = subs.find((s: any) => s.status === 'ACTIVE' || s.status === 'PAUSED');
    } catch {}
  }

  // ─── PAUSE ─────────────────────────────────────────────
  if (action === 'pause') {
    if (subscription) await pauseSubscription(subscription.id).catch(() => {});
    // Update local state
    if (!mf.custom) mf.custom = {};
    mf.custom.membership_status = 'paused';
    await db.update(customersProjection).set({ metafields: mf }).where(eq(customersProjection.shopifyCustomerId, customerId));
    await updateCustomerMetafield(Number(customerId), 'custom', 'membership_status', 'paused', 'single_line_text_field').catch(() => {});
    return NextResponse.json({ data: { status: 'paused' } });
  }

  // ─── CANCEL ────────────────────────────────────────────
  if (action === 'cancel') {
    if (subscription) await cancelSubscription(subscription.id).catch(() => {});
    const grace = new Date(); grace.setDate(grace.getDate() + 60);
    if (!mf.custom) mf.custom = {};
    mf.custom.membership_status = 'cancelled';
    mf.custom.cancel_grace_ends = grace.toISOString().slice(0, 10);
    await db.update(customersProjection).set({ metafields: mf }).where(eq(customersProjection.shopifyCustomerId, customerId));
    await updateCustomerMetafield(Number(customerId), 'custom', 'membership_status', 'cancelled', 'single_line_text_field').catch(() => {});
    await updateCustomerMetafield(Number(customerId), 'custom', 'cancel_grace_ends', grace.toISOString().slice(0, 10), 'date').catch(() => {});

    await db.insert(auditLog).values({ action: 'update', entityType: 'membership', entityId: customerId, staffId: 'customer', surface: 'storefront', diff: { action: 'cancel', graceEnds: grace.toISOString().slice(0, 10) } });
    return NextResponse.json({ data: { status: 'cancelled', graceEnds: grace.toISOString().slice(0, 10) } });
  }

  // ─── REACTIVATE ────────────────────────────────────────
  if (action === 'reactivate') {
    if (subscription) await activateSubscription(subscription.id).catch(() => {});
    if (!mf.custom) mf.custom = {};
    mf.custom.membership_status = 'active';
    delete mf.custom.cancel_grace_ends;
    await db.update(customersProjection).set({ metafields: mf }).where(eq(customersProjection.shopifyCustomerId, customerId));
    await updateCustomerMetafield(Number(customerId), 'custom', 'membership_status', 'active', 'single_line_text_field').catch(() => {});
    return NextResponse.json({ data: { status: 'active' } });
  }

  // ─── CHANGE TIER ───────────────────────────────────────
  if (action === 'change' && newTier) {
    const tierConfig = TIERS[newTier as keyof typeof TIERS];
    if (!tierConfig) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });

    // Determine current billing period from subscription or default to monthly
    let period: 'monthly' | 'annual' = 'monthly';
    if (subscription?.billingPolicy?.interval === 'YEAR') period = 'annual';

    // Swap variant on the subscription
    if (subscription) {
      const newVariant = getVariantForChange(newTier, period);
      if (newVariant && subscription.lines?.nodes?.[0]) {
        await updateSubscriptionVariant(
          subscription.id,
          subscription.lines.nodes[0].id,
          newVariant.variantId,
          String(newVariant.price)
        ).catch(() => {});
      }
    }

    // Update tags
    const tags = (client.tags ?? []).filter(t => !t.startsWith('member-'));
    tags.push(tierConfig.tag);
    await db.update(customersProjection).set({ tags, syncedAt: new Date() }).where(eq(customersProjection.shopifyCustomerId, customerId));

    // Update Shopify tags
    if (currentTier) {
      const oldTag = TIERS[currentTier as keyof typeof TIERS]?.tag;
      if (oldTag) await removeCustomerTag(Number(customerId), oldTag).catch(() => {});
    }
    await addCustomerTag(Number(customerId), tierConfig.tag).catch(() => {});
    await updateCustomerMetafield(Number(customerId), 'custom', 'membership_status', 'active', 'single_line_text_field').catch(() => {});

    await db.insert(auditLog).values({ action: 'update', entityType: 'membership', entityId: customerId, staffId: 'customer', surface: 'storefront', diff: { from: currentTier, to: newTier, period } });
    return NextResponse.json({ data: { tier: newTier, status: 'active' } });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
