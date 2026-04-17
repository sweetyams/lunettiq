import { inngest } from './client';
import { db } from '@/lib/db';
import { eq, sql, or } from 'drizzle-orm';
import {
  customersProjection,
  ordersProjection,
  productsProjection,
  productVariantsProjection,
  collectionsProjection,
  duplicateCandidates,
  creditsLedger,
} from '@/lib/db/schema';
import { getProductMetafields } from '@/lib/crm/shopify-admin';

// ─── Customer sync ───────────────────────────────────────

export const syncCustomer = inngest.createFunction(
  { id: 'sync-customer', retries: 3, triggers: [{ event: 'shopify/customer.updated' }] },
  async ({ event }) => {
    const c = event.data;
    const updateSet: Record<string, unknown> = {
      email: c.email,
      phone: c.phone,
      firstName: c.first_name,
      lastName: c.last_name,
      totalSpent: c.total_spent,
      orderCount: c.orders_count,
      tags: c.tags?.split(', ').filter(Boolean) ?? [],
      defaultAddress: c.default_address,
      addresses: c.addresses,
      acceptsMarketing: c.accepts_marketing ?? false,
      shopifyUpdatedAt: c.updated_at ? new Date(c.updated_at) : undefined,
      syncedAt: new Date(),
    };
    // Only overwrite metafields if Shopify actually sent them
    if (c.metafields != null) updateSet.metafields = c.metafields;

    await db
      .insert(customersProjection)
      .values({
        shopifyCustomerId: String(c.id),
        ...updateSet,
        metafields: c.metafields ?? null,
        smsConsent: false,
        createdAt: c.created_at ? new Date(c.created_at) : undefined,
      })
      .onConflictDoUpdate({
        target: customersProjection.shopifyCustomerId,
        set: updateSet,
      });
  }
);

// ─── Order sync ──────────────────────────────────────────

export const syncOrder = inngest.createFunction(
  { id: 'sync-order', retries: 3, triggers: [{ event: 'shopify/order.updated' }] },
  async ({ event }) => {
    const o = event.data;
    await db
      .insert(ordersProjection)
      .values({
        shopifyOrderId: String(o.id),
        shopifyCustomerId: o.customer?.id ? String(o.customer.id) : null,
        orderNumber: String(o.order_number),
        financialStatus: o.financial_status,
        fulfillmentStatus: o.fulfillment_status,
        totalPrice: o.total_price,
        subtotalPrice: o.subtotal_price,
        currency: o.currency,
        lineItems: o.line_items,
        shippingAddress: o.shipping_address,
        tags: o.tags?.split(', ').filter(Boolean) ?? [],
        cancelledAt: o.cancelled_at ? new Date(o.cancelled_at) : null,
        processedAt: o.processed_at ? new Date(o.processed_at) : null,
        createdAt: o.created_at ? new Date(o.created_at) : undefined,
        shopifyUpdatedAt: o.updated_at ? new Date(o.updated_at) : undefined,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: ordersProjection.shopifyOrderId,
        set: {
          shopifyCustomerId: o.customer?.id ? String(o.customer.id) : null,
          financialStatus: o.financial_status,
          fulfillmentStatus: o.fulfillment_status,
          totalPrice: o.total_price,
          subtotalPrice: o.subtotal_price,
          lineItems: o.line_items,
          shippingAddress: o.shipping_address,
          tags: o.tags?.split(', ').filter(Boolean) ?? [],
          cancelledAt: o.cancelled_at ? new Date(o.cancelled_at) : null,
          shopifyUpdatedAt: o.updated_at ? new Date(o.updated_at) : undefined,
          syncedAt: new Date(),
        },
      });
  }
);

// ─── Product sync ────────────────────────────────────────

export const syncProduct = inngest.createFunction(
  { id: 'sync-product', retries: 3, triggers: [{ event: 'shopify/product.updated' }] },
  async ({ event }) => {
    const p = event.data;
    const prices = (p.variants ?? []).map((v: { price: string }) => parseFloat(v.price));
    const priceMin = prices.length ? String(Math.min(...prices)) : null;
    const priceMax = prices.length ? String(Math.max(...prices)) : null;

    const productUpdateSet: Record<string, unknown> = {
      handle: p.handle,
      title: p.title,
      description: p.body_html,
      productType: p.product_type,
      vendor: p.vendor,
      tags: p.tags?.split(', ').filter(Boolean) ?? [],
      images: p.images?.map((i: { src: string }) => i.src) ?? [],
      priceMin,
      priceMax,
      shopifyUpdatedAt: p.updated_at ? new Date(p.updated_at) : undefined,
      syncedAt: new Date(),
    };
    if (p.metafields != null) productUpdateSet.metafields = p.metafields;

    await db
      .insert(productsProjection)
      .values({
        shopifyProductId: String(p.id),
        ...productUpdateSet,
        metafields: p.metafields ?? null,
        createdAt: p.created_at ? new Date(p.created_at) : undefined,
      })
      .onConflictDoUpdate({
        target: productsProjection.shopifyProductId,
        set: productUpdateSet,
      });

    for (const v of p.variants ?? []) {
      await db
        .insert(productVariantsProjection)
        .values({
          shopifyVariantId: String(v.id),
          shopifyProductId: String(p.id),
          title: v.title,
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compare_at_price,
          inventoryQuantity: v.inventory_quantity,
          selectedOptions: v.option_values ?? null,
          imageUrl: v.image_id ? p.images?.find((i: { id: number }) => i.id === v.image_id)?.src : null,
          availableForSale: v.inventory_quantity > 0,
          syncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: productVariantsProjection.shopifyVariantId,
          set: {
            title: v.title,
            sku: v.sku,
            price: v.price,
            compareAtPrice: v.compare_at_price,
            inventoryQuantity: v.inventory_quantity,
            selectedOptions: v.option_values ?? null,
            availableForSale: v.inventory_quantity > 0,
            syncedAt: new Date(),
          },
        });
    }

    // Fetch metafields via Admin API (webhooks don't include them)
    const metaResult = await getProductMetafields(Number(p.id));
    if (metaResult.ok && metaResult.data.length) {
      const grouped: Record<string, Record<string, string>> = {};
      for (const mf of metaResult.data) {
        if (!grouped[mf.namespace]) grouped[mf.namespace] = {};
        grouped[mf.namespace][mf.key] = mf.value;
      }
      await db.update(productsProjection).set({ metafields: grouped }).where(eq(productsProjection.shopifyProductId, String(p.id)));
    }
  }
);

// ─── Collection sync ─────────────────────────────────────

export const syncCollection = inngest.createFunction(
  { id: 'sync-collection', retries: 3, triggers: [{ event: 'shopify/collection.updated' }] },
  async ({ event }) => {
    const c = event.data;
    await db
      .insert(collectionsProjection)
      .values({
        shopifyCollectionId: String(c.id),
        handle: c.handle,
        title: c.title,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: collectionsProjection.shopifyCollectionId,
        set: {
          handle: c.handle,
          title: c.title,
          syncedAt: new Date(),
        },
      });
  }
);

import { TIERS, getTierFromTags } from '@/lib/crm/loyalty-config';

// ─── Dedup scan ──────────────────────────────────────────

export const dedupScan = inngest.createFunction(
  { id: 'dedup-scan', retries: 1, triggers: [{ cron: '0 3 * * *' }, { event: 'crm/dedup.scan' }] },
  async () => {
    const customers = await db
      .select({
        id: customersProjection.shopifyCustomerId,
        email: customersProjection.email,
        phone: customersProjection.phone,
        firstName: customersProjection.firstName,
        lastName: customersProjection.lastName,
        tags: customersProjection.tags,
      })
      .from(customersProjection);

    const isMerged = (tags: string[] | null) => (tags ?? []).some(t => t.startsWith('merged-into-'));
    const active = customers.filter(c => !isMerged(c.tags));

    // Existing pairs to skip — only pending/merged, not dismissed
    const existing = await db.select({ a: duplicateCandidates.clientA, b: duplicateCandidates.clientB })
      .from(duplicateCandidates)
      .where(or(eq(duplicateCandidates.status, 'pending'), eq(duplicateCandidates.status, 'merged')));
    const pairSet = new Set(existing.map(e => [e.a, e.b].sort().join('|')));

    const toInsert: { clientA: string; clientB: string; matchReason: string; confidence: string }[] = [];

    // Exact email matches
    const byEmail = new Map<string, string[]>();
    for (const c of active) {
      if (!c.email) continue;
      const key = c.email.toLowerCase().trim();
      if (!byEmail.has(key)) byEmail.set(key, []);
      byEmail.get(key)!.push(c.id);
    }
    for (const ids of Array.from(byEmail.values())) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pair = [ids[i], ids[j]].sort().join('|');
          if (!pairSet.has(pair)) { pairSet.add(pair); toInsert.push({ clientA: ids[i], clientB: ids[j], matchReason: 'exact_email', confidence: '0.95' }); }
        }
      }
    }

    // Exact phone matches
    const byPhone = new Map<string, string[]>();
    for (const c of active) {
      if (!c.phone) continue;
      const key = c.phone.replace(/\D/g, '');
      if (!key) continue;
      if (!byPhone.has(key)) byPhone.set(key, []);
      byPhone.get(key)!.push(c.id);
    }
    for (const ids of Array.from(byPhone.values())) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pair = [ids[i], ids[j]].sort().join('|');
          if (!pairSet.has(pair)) { pairSet.add(pair); toInsert.push({ clientA: ids[i], clientB: ids[j], matchReason: 'exact_phone', confidence: '0.90' }); }
        }
      }
    }

    // Exact normalized name matches
    const norm = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
    const byName = new Map<string, string[]>();
    for (const c of active) {
      const key = norm(c.firstName) + '|' + norm(c.lastName);
      if (!key || key === '|') continue;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(c.id);
    }
    for (const ids of Array.from(byName.values())) {
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pair = [ids[i], ids[j]].sort().join('|');
          if (!pairSet.has(pair)) { pairSet.add(pair); toInsert.push({ clientA: ids[i], clientB: ids[j], matchReason: 'exact_name', confidence: '0.80' }); }
        }
      }
    }

    if (toInsert.length) {
      await db.insert(duplicateCandidates).values(toInsert);
    }

    return { found: toInsert.length };
  }
);

// functions array is at the end of the file

// ─── Monthly credit issuance ─────────────────────────────

export const monthlyCredits = inngest.createFunction(
  { id: 'monthly-credits', retries: 2, triggers: [{ cron: '0 6 1 * *' }] },
  async () => {
    let issued = 0;
    for (const [, config] of Object.entries(TIERS)) {
      const members = await db.select({ id: customersProjection.shopifyCustomerId })
        .from(customersProjection)
        .where(sql`${config.tag} = ANY(${customersProjection.tags})`);

      for (const m of members) {
        const balResult = await db.select({ total: sql<string>`coalesce(sum(${creditsLedger.amount}), 0)` })
          .from(creditsLedger).where(eq(creditsLedger.shopifyCustomerId, m.id));
        const balance = Number(balResult[0]?.total ?? 0);
        const newBalance = balance + config.monthlyCredit;

        await db.insert(creditsLedger).values({
          shopifyCustomerId: m.id, transactionType: 'issued_membership',
          amount: String(config.monthlyCredit), runningBalance: String(newBalance),
          reason: `Monthly ${config.label} credit`,
        });
        issued++;
      }
    }
    return { issued };
  }
);

// ─── Birthday credits ────────────────────────────────────

export const birthdayCredits = inngest.createFunction(
  { id: 'birthday-credits', retries: 2, triggers: [{ cron: '0 7 * * *' }] },
  async () => {
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const members = await db.select({ id: customersProjection.shopifyCustomerId, tags: customersProjection.tags, metafields: customersProjection.metafields })
      .from(customersProjection)
      .where(sql`${customersProjection.metafields}->'custom'->>'birthday' LIKE ${'%' + mmdd}`);

    let issued = 0;
    for (const m of members) {
      const tier = getTierFromTags(m.tags);
      if (!tier) continue;
      const credit = TIERS[tier].birthdayCredit;

      const balResult = await db.select({ total: sql<string>`coalesce(sum(${creditsLedger.amount}), 0)` })
        .from(creditsLedger).where(eq(creditsLedger.shopifyCustomerId, m.id));
      const newBalance = Number(balResult[0]?.total ?? 0) + credit;

      await db.insert(creditsLedger).values({
        shopifyCustomerId: m.id, transactionType: 'issued_birthday',
        amount: String(credit), runningBalance: String(newBalance),
        reason: 'Birthday credit',
      });
      issued++;
    }
    return { issued };
  }
);

// ─── Nightly credit reconciliation ───────────────────────

export const creditReconciliation = inngest.createFunction(
  { id: 'credit-reconciliation', retries: 1, triggers: [{ cron: '0 2 * * *' }] },
  async () => {
    const members = await db.select({ id: customersProjection.shopifyCustomerId, metafields: customersProjection.metafields, tags: customersProjection.tags })
      .from(customersProjection)
      .where(sql`${customersProjection.tags} && ARRAY['member-essential','member-cult','member-vault']`);

    let corrected = 0;
    let flagged = 0;
    for (const m of members) {
      const meta = ((m.metafields as Record<string, Record<string, string>> | null)?.custom) ?? {};
      const shopifyBalance = Number(meta.credits_balance ?? 0);

      const ledgerResult = await db.select({ total: sql<string>`coalesce(sum(${creditsLedger.amount}), 0)` })
        .from(creditsLedger).where(eq(creditsLedger.shopifyCustomerId, m.id));
      const ledgerBalance = Number(ledgerResult[0]?.total ?? 0);

      const drift = Math.abs(shopifyBalance - ledgerBalance);
      if (drift < 0.01) continue;

      if (drift < 5) {
        // const correction = ledgerBalance - shopifyBalance;
        // Auto-correct: trust the ledger
        await db.insert(creditsLedger).values({
          shopifyCustomerId: m.id, transactionType: 'adjustment',
          amount: String(0), runningBalance: String(ledgerBalance),
          reason: `Reconciliation: Shopify showed $${shopifyBalance.toFixed(2)}, ledger shows $${ledgerBalance.toFixed(2)}`,
        });
        corrected++;
      } else {
        flagged++;
      }
    }
    return { corrected, flagged };
  }
);

// ─── Daily email digest ──────────────────────────────

export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest', retries: 1, triggers: [{ cron: '0 8 * * *' }] },
  async () => {
    const { notifications } = await import('@/lib/db/schema');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get all unread notifications from last 24h grouped by user
    const recent = await db.select().from(notifications)
      .where(sql`${notifications.createdAt} >= ${yesterday.toISOString()}`);

    const byUser = new Map<string, typeof recent>();
    for (const n of recent) {
      if (!byUser.has(n.userId)) byUser.set(n.userId, []);
      byUser.get(n.userId)!.push(n);
    }

    // Get staff emails from Clerk
    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) return { sent: 0 };

    const res = await fetch('https://api.clerk.com/v1/users?limit=50', { headers: { Authorization: `Bearer ${secret}` } });
    if (!res.ok) return { sent: 0 };
    const users = ((await res.json()).data || []) as Array<{ id: string; email_addresses: Array<{ email_address: string }>; first_name: string }>;

    let sent = 0;
    for (const user of users) {
      const userNotifs = byUser.get(user.id);
      if (!userNotifs?.length) continue;

      const email = user.email_addresses[0]?.email_address;
      if (!email) continue;

      const unread = userNotifs.filter(n => !n.readAt);
      if (!unread.length) continue;

      // Build summary
      const lines = unread.slice(0, 20).map(n => `• ${n.title}${n.body ? ` — ${n.body}` : ''}`).join('\n');
      const subject = `Lunettiq CRM: ${unread.length} notification${unread.length > 1 ? 's' : ''} today`;
      const body = `Hi ${user.first_name || 'there'},\n\nHere's your daily summary:\n\n${lines}${unread.length > 20 ? `\n\n...and ${unread.length - 20} more` : ''}\n\nView all in the CRM: ${process.env.NEXT_PUBLIC_APP_URL || 'https://lunettiq.vercel.app'}/crm\n\n— Lunettiq CRM`;

      // Send via Inngest send event (or log for now)
      console.log(`[daily-digest] Would email ${email}: ${subject}`);
      console.log(body);
      sent++;
    }

    return { sent, totalNotifications: recent.length };
  }
);

export const functions = [syncCustomer, syncOrder, syncProduct, syncCollection, dedupScan, monthlyCredits, birthdayCredits, creditReconciliation, dailyDigest];
