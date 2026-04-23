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
  productFamilies,
  productFamilyMembers,
  productFilters,
  filterGroups,
  draftOrdersProjection,
} from '@/lib/db/schema';
import { getProductMetafields } from '@/lib/crm/shopify-admin';
import { toSlug } from '@/lib/shopify/slug';

const TYPE_SUFFIXES = ['sun', 'optic', 'optics', 'sunglasses'];

/** Auto-assign a product to family + filters based on handle pattern */
async function autoAssignProduct(productId: string, handle: string) {
  if (!handle) return;
  const parts = handle.split('-');

  // Parse handle for family, type, colour
  let family: string | null = null;
  let type: string | null = null;
  let colour: string | null = null;

  const typeIdx = parts.findIndex(p => p === 'opt' || p === 'sun');
  if (typeIdx >= 0 && typeIdx < parts.length - 1) {
    family = parts.slice(0, typeIdx).join('-');
    type = parts[typeIdx] === 'opt' ? 'optical' : 'sun';
    colour = parts.slice(typeIdx + 1).join('-');
  } else {
    const cIdx = parts.indexOf('©');
    if (cIdx >= 0 && cIdx < parts.length - 1) {
      family = parts.slice(0, cIdx).join('-');
      let tail = parts.slice(cIdx + 1);
      if (tail.length > 1 && /^\d+$/.test(tail[tail.length - 1])) tail = tail.slice(0, -1);
      if (tail.length > 1 && TYPE_SUFFIXES.includes(tail[tail.length - 1])) {
        type = tail[tail.length - 1] === 'sun' || tail[tail.length - 1] === 'sunglasses' ? 'sun' : 'optical';
        tail = tail.slice(0, -1);
      } else {
        type = 'optical';
      }
      colour = tail.join('-');
    }
  }

  // Auto-assign to family
  if (family) {
    const existing = await db.select().from(productFamilies).where(eq(productFamilies.id, family)).then(r => r[0]);
    if (existing) {
      await db.insert(productFamilyMembers)
        .values({ familyId: family, productId, type, colour, colourHex: null, sortOrder: 0 })
        .onConflictDoNothing();
      // Regenerate family slugs so new member gets family-derived slug
      const { regenerateFamilySlugs } = await import('@/lib/crm/regenerate-slugs');
      await regenerateFamilySlugs(family);
    }
  }

  // Auto-assign colour filter
  if (colour) {
    const colourGroup = await db.select().from(filterGroups)
      .where(eq(filterGroups.id, `colour:${colour}`)).then(r => r[0]);
    if (colourGroup) {
      await db.insert(productFilters)
        .values({ productId, filterGroupId: `colour:${colour}`, status: 'auto' })
        .onConflictDoNothing();
    }
  }

  // Auto-assign shape filters from metafields
  const product = await db.execute(sql`
    SELECT metafields->'custom'->>'face_shapes' as shapes
    FROM products_projection WHERE shopify_product_id = ${productId}
  `).then(r => r.rows[0] as { shapes: string | null } | undefined);
  if (product?.shapes) {
    try {
      const shapes = JSON.parse(product.shapes);
      for (const s of shapes) {
        const shapeSlug = s.handle ?? s;
        await db.insert(productFilters)
          .values({ productId, filterGroupId: `shape:${shapeSlug}`, status: 'auto' })
          .onConflictDoNothing();
      }
    } catch {}
  }

  // Auto-assign size from sizing_dimensions
  const sizing = await db.execute(sql`
    SELECT metafields->'custom'->>'sizing_dimensions' as sizing
    FROM products_projection WHERE shopify_product_id = ${productId}
  `).then(r => r.rows[0] as { sizing: string | null } | undefined);
  if (sizing?.sizing) {
    const fwMatch = sizing.sizing.match(/(?:Frame width|Width):\s*(\d+)/i);
    if (fwMatch) {
      const fw = Number(fwMatch[1]);
      const size = fw <= 128 ? 'small' : fw <= 138 ? 'medium' : 'large';
      await db.insert(productFilters)
        .values({ productId, filterGroupId: `size:${size}`, status: 'auto' })
        .onConflictDoNothing();
    }
  }

  // Set product_category metafield (optical/sun)
  if (type) {
    await db.execute(sql`
      UPDATE products_projection
      SET metafields = jsonb_set(COALESCE(metafields, '{}'::jsonb), '{custom,product_category}', ${JSON.stringify(type)}::jsonb)
      WHERE shopify_product_id = ${productId}
    `);
  }
}

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

    // Update customer total_spent + order_count
    const custId = o.customer?.id ? String(o.customer.id) : null;
    if (custId) {
      await db.execute(sql`
        UPDATE customers_projection SET
          order_count = (SELECT count(*) FROM orders_projection WHERE shopify_customer_id = ${custId}),
          total_spent = (SELECT coalesce(sum(total_price::numeric), 0) FROM orders_projection WHERE shopify_customer_id = ${custId}),
          synced_at = now()
        WHERE shopify_customer_id = ${custId}
      `);
    }
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
      status: p.status ?? 'active',
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

    // Slug: family-owned if in a family, else derived from handle
    const [familyRow] = await db.select({ familyId: productFamilyMembers.familyId })
      .from(productFamilyMembers)
      .where(eq(productFamilyMembers.productId, String(p.id)))
      .limit(1);
    if (familyRow) {
      const { regenerateFamilySlugs } = await import('@/lib/crm/regenerate-slugs');
      await regenerateFamilySlugs(familyRow.familyId);
    } else if (p.handle) {
      await db.update(productsProjection)
        .set({ slug: toSlug(p.handle) })
        .where(eq(productsProjection.shopifyProductId, String(p.id)));
    }

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
            imageUrl: v.image_id ? p.images?.find((i: { id: number }) => i.id === v.image_id)?.src : null,
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
      // Migrate udesly namespace into custom
      if (grouped.udesly) {
        if (!grouped.custom) grouped.custom = {};
        const remap: Record<string, string> = { swatch: 'swatch', 'short-name': 'short_name', description: 'short_description', season: 'season', 'face-shape-recommendation': 'face_shapes', 'available-in-these-colors': 'sibling_colours', 'alter-ego': 'alter_ego', featured: 'featured', latest: 'latest', 'ben-s-favourites': 'staff_pick' };
        for (const [oldKey, newKey] of Object.entries(remap)) {
          if (grouped.udesly[oldKey] && !grouped.custom[newKey]) grouped.custom[newKey] = grouped.udesly[oldKey];
        }
        delete grouped.udesly;
      }
      await db.update(productsProjection).set({ metafields: grouped }).where(eq(productsProjection.shopifyProductId, String(p.id)));
    }

    // Auto-assign to family and filters for new/updated products
    await autoAssignProduct(String(p.id), p.handle);

    // Invalidate configurator channel resolution cache
    const { cacheInvalidate } = await import('@/lib/crm/configurator-resolve');
    await cacheInvalidate(String(p.id));
  }
);

// ─── Product delete ──────────────────────────────────────

export const deleteProduct = inngest.createFunction(
  { id: 'delete-product', retries: 2, triggers: [{ event: 'shopify/product.deleted' }] },
  async ({ event }) => {
    const id = String(event.data.id);
    await db.delete(productVariantsProjection).where(eq(productVariantsProjection.shopifyProductId, id));
    await db.delete(productsProjection).where(eq(productsProjection.shopifyProductId, id));
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
  { id: 'birthday-credits', retries: 2, triggers: [{ cron: '0 5 * * *' }] }, // 5am UTC = midnight ET (summer)
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
    const { getKey } = await import('@/lib/crm/integration-keys');
    const secret = await getKey('CLERK_SECRET_KEY');
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

// ─── Appointment Reminders ───────────────────────────────

export const appointmentReminders = inngest.createFunction(
  { id: 'appointment-reminders', retries: 2, triggers: [{ cron: '0 * * * *' }] },
  async () => {
    const { appointments, customersProjection, locations } = await import('@/lib/db/schema');
    const { and, gte, lt, isNull } = await import('drizzle-orm');
    const { fireKlaviyoEvent } = await import('@/lib/klaviyo/events');

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600000);
    const in25h = new Date(now.getTime() + 25 * 3600000);

    // Find appointments starting in 24–25h that haven't been reminded
    const rows = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        startsAt: appointments.startsAt,
        locationId: appointments.locationId,
        customerId: appointments.shopifyCustomerId,
        email: customersProjection.email,
        firstName: customersProjection.firstName,
        locationName: locations.name,
      })
      .from(appointments)
      .leftJoin(customersProjection, sql`${appointments.shopifyCustomerId} = ${customersProjection.shopifyCustomerId}`)
      .leftJoin(locations, sql`${appointments.locationId} = ${locations.id}`)
      .where(and(
        gte(appointments.startsAt, in24h),
        lt(appointments.startsAt, in25h),
        isNull(appointments.reminderSentAt),
        sql`${appointments.status} IN ('scheduled', 'confirmed')`,
      ));

    let sent = 0;
    for (const r of rows) {
      if (r.email) {
        const time = r.startsAt.toLocaleString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        await fireKlaviyoEvent(r.email, 'Appointment Reminder', {
          appointment_title: r.title,
          appointment_time: time,
          location_name: r.locationName,
          first_name: r.firstName,
        });
        sent++;
      }
      await db.update(appointments).set({ reminderSentAt: now }).where(sql`${appointments.id} = ${r.id}`);
    }

    return { checked: rows.length, sent };
  }
);

// ─── Points: Purchase Earning ────────────────────────────

export const pointsOnPurchase = inngest.createFunction(
  { id: 'points-on-purchase', retries: 2, triggers: [{ event: 'shopify/order.created' }] },
  async ({ event }) => {
    const { issuePoints, getPointsBalance } = await import('@/lib/crm/points');
    const o = event.data;
    const customerId = String(o.customer?.id ?? '');
    if (!customerId) return { skipped: true };

    const net = Math.floor(Number(o.total_price ?? 0));
    if (net <= 0) return { skipped: true };

    // 1 pt per $1
    await issuePoints({ customerId, amount: net, type: 'points_issued_purchase', reason: `${net} pts on order #${o.order_number}`, relatedOrderId: String(o.id) });

    // First purchase bonus
    const orderCount = o.customer?.orders_count ?? 1;
    if (orderCount <= 1) {
      await issuePoints({ customerId, amount: 500, type: 'points_issued_purchase', reason: 'First purchase bonus (500 pts)' });
    }

    return { customerId, pointsIssued: net + (orderCount <= 1 ? 500 : 0) };
  }
);

// ─── Points: Birthday ────────────────────────────────────

export const pointsBirthday = inngest.createFunction(
  { id: 'points-birthday', retries: 2, triggers: [{ cron: '0 8 * * *' }] },
  async () => {
    const { customersProjection } = await import('@/lib/db/schema');
    const { issuePoints } = await import('@/lib/crm/points');
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const clients = await db.select({ id: customersProjection.shopifyCustomerId, meta: customersProjection.metafields })
      .from(customersProjection);

    let sent = 0;
    for (const c of clients) {
      const bday = ((c.meta as any)?.custom?.birthday ?? '') as string;
      if (bday.includes(`-${mm}-${dd}`)) {
        await issuePoints({ customerId: c.id, amount: 200, type: 'points_issued_birthday', reason: 'Birthday bonus (200 pts)' });
        sent++;
      }
    }
    return { sent };
  }
);

// ─── Points: Expiry Scan (warnings) ─────────────────────

export const pointsExpiryScan = inngest.createFunction(
  { id: 'points-expiry-scan', retries: 1, triggers: [{ cron: '0 3 * * *' }] },
  async () => {
    const { creditsLedger } = await import('@/lib/db/schema');
    const { and, gte, lt, gt, isNull } = await import('drizzle-orm');
    const { fireKlaviyoEvent } = await import('@/lib/klaviyo/events');
    const { customersProjection } = await import('@/lib/db/schema');

    const now = new Date();
    const warnings = [90, 30, 7];
    let total = 0;

    for (const days of warnings) {
      const target = new Date(now.getTime() + days * 86400000);
      const targetEnd = new Date(target.getTime() + 86400000);

      const expiring = await db.select({
        customerId: creditsLedger.shopifyCustomerId,
        amount: creditsLedger.amount,
        expiresAt: creditsLedger.expiresAt,
      }).from(creditsLedger).where(and(
        sql`${creditsLedger.currency} = 'points'`,
        gt(creditsLedger.amount, sql`0`),
        gte(creditsLedger.expiresAt, target),
        lt(creditsLedger.expiresAt, targetEnd),
      ));

      for (const row of expiring) {
        const cust = await db.select({ email: customersProjection.email, firstName: customersProjection.firstName })
          .from(customersProjection).where(sql`${customersProjection.shopifyCustomerId} = ${row.customerId}`).then(r => r[0]);
        if (cust?.email) {
          await fireKlaviyoEvent(cust.email, 'Points Expiry Warning', {
            days_until_expiry: days, points: Number(row.amount), first_name: cust.firstName,
          });
          total++;
        }
      }
    }
    return { warnings: total };
  }
);

// ─── Points: Expiry Execute ─────────────────────────────

export const pointsExpiryExecute = inngest.createFunction(
  { id: 'points-expiry-execute', retries: 1, triggers: [{ cron: '0 4 * * *' }] },
  async () => {
    const { creditsLedger } = await import('@/lib/db/schema');
    const { and, lt, gt } = await import('drizzle-orm');
    const { getPointsBalance } = await import('@/lib/crm/points');

    const now = new Date();
    const expired = await db.select({ id: creditsLedger.id, customerId: creditsLedger.shopifyCustomerId, amount: creditsLedger.amount })
      .from(creditsLedger).where(and(
        sql`${creditsLedger.currency} = 'points'`,
        gt(creditsLedger.amount, sql`0`),
        lt(creditsLedger.expiresAt, now),
      ));

    let count = 0;
    for (const row of expired) {
      const pts = Number(row.amount);
      const balance = await getPointsBalance(row.customerId);
      await db.insert(creditsLedger).values({
        shopifyCustomerId: row.customerId, currency: 'points',
        transactionType: 'points_expired', amount: String(-pts),
        runningBalance: String(balance - pts), reason: `${pts} points expired`,
      });
      // Zero out the original entry's expiry so it's not re-processed
      await db.update(creditsLedger).set({ expiresAt: null }).where(sql`${creditsLedger.id} = ${row.id}`);
      count++;
    }
    return { expired: count };
  }
);

// ─── Trial Conversion Scan ───────────────────────────────

export const trialConversionScan = inngest.createFunction(
  { id: 'trial-conversion-scan', retries: 2, triggers: [{ cron: '0 * * * *' }] },
  async () => {
    const { membershipTrials } = await import('@/lib/db/schema');
    const { and, lt } = await import('drizzle-orm');
    const now = new Date();

    const due = await db.select().from(membershipTrials)
      .where(and(sql`${membershipTrials.outcome} = 'pending'`, lt(membershipTrials.convertsAt, now)));

    let converted = 0;
    for (const trial of due) {
      // Auto-convert to paid
      await db.update(membershipTrials).set({ outcome: 'converted' }).where(sql`${membershipTrials.id} = ${trial.id}`);
      converted++;
    }
    return { converted };
  }
);

// ─── Trial Reminders ─────────────────────────────────────

export const trialReminder = inngest.createFunction(
  { id: 'trial-reminder', retries: 1, triggers: [{ cron: '0 9 * * *' }] },
  async () => {
    const { membershipTrials, customersProjection } = await import('@/lib/db/schema');
    const { fireKlaviyoEvent } = await import('@/lib/klaviyo/events');
    const now = new Date();
    const day23 = new Date(now.getTime() + 8 * 86400000); // 8 days left = day 23
    const day28 = new Date(now.getTime() + 3 * 86400000); // 3 days left = day 28

    const trials = await db.select().from(membershipTrials).where(sql`${membershipTrials.outcome} = 'pending'`);
    let sent = 0;

    for (const t of trials) {
      const daysLeft = Math.round((new Date(t.convertsAt!).getTime() - now.getTime()) / 86400000);
      if (daysLeft !== 8 && daysLeft !== 3) continue;

      const cust = await db.select({ email: customersProjection.email, firstName: customersProjection.firstName })
        .from(customersProjection).where(sql`${customersProjection.shopifyCustomerId} = ${t.shopifyCustomerId}`).then(r => r[0]);
      if (!cust?.email) continue;

      await fireKlaviyoEvent(cust.email, daysLeft === 8 ? 'Trial Reminder Day 23' : 'Trial Reminder Day 28', {
        days_left: daysLeft, first_name: cust.firstName, credits_used: Number(t.creditsUsedDuringTrial ?? 0),
      });
      sent++;
    }
    return { sent };
  }
);

// ─── Referral Qualification ──────────────────────────────

export const referralQualify = inngest.createFunction(
  { id: 'referral-qualify', retries: 2, triggers: [{ event: 'loyalty/referral.check' }] },
  async ({ event }) => {
    const { referrals: referralsTable, customersProjection, creditsLedger: ledger } = await import('@/lib/db/schema');
    const { issuePoints, getCreditBalance } = await import('@/lib/crm/points');
    const { getTierFromTags } = await import('@/lib/crm/loyalty-config');
    const { and, eq: eqOp } = await import('drizzle-orm');

    const { referredCustomerId, orderId, orderTotal } = event.data;
    if (!referredCustomerId || Number(orderTotal) < 100) return { skipped: true, reason: 'Under $100' };

    const ref = await db.select().from(referralsTable)
      .where(and(eqOp(referralsTable.referredCustomerId, referredCustomerId), eqOp(referralsTable.status, 'pending')))
      .then(r => r[0]);
    if (!ref) return { skipped: true, reason: 'No pending referral' };

    if (ref.clickedAt && Date.now() - new Date(ref.clickedAt).getTime() > 90 * 86400000) {
      await db.update(referralsTable).set({ status: 'expired' }).where(eqOp(referralsTable.id, ref.id));
      return { skipped: true, reason: 'Expired (>90 days)' };
    }

    // Get referrer tier
    const referrer = await db.select({ tags: customersProjection.tags })
      .from(customersProjection).where(eqOp(customersProjection.shopifyCustomerId, ref.referrerCustomerId)).then(r => r[0]);
    const tier = getTierFromTags(referrer?.tags ?? null);

    // Tier-weighted rewards
    const REWARDS: Record<string, { referrerAmount: number; referrerCurrency: 'credit' | 'points'; referredDiscount: number }> = {
      default: { referrerAmount: 2500, referrerCurrency: 'points', referredDiscount: 25 },
      essential: { referrerAmount: 30, referrerCurrency: 'credit', referredDiscount: 25 },
      cult: { referrerAmount: 50, referrerCurrency: 'credit', referredDiscount: 25 },
      vault: { referrerAmount: 75, referrerCurrency: 'credit', referredDiscount: 40 },
    };
    const reward = REWARDS[tier ?? 'default'] ?? REWARDS.default;

    await db.update(referralsTable).set({
      status: 'qualified', qualifiedAt: new Date(), qualifyingOrderId: orderId,
      referrerTierAtQualification: tier ?? 'non-member',
      referrerRewardAmount: String(reward.referrerAmount), referrerRewardCurrency: reward.referrerCurrency,
    }).where(eqOp(referralsTable.id, ref.id));

    // Issue referrer reward
    if (reward.referrerCurrency === 'points') {
      await issuePoints({ customerId: ref.referrerCustomerId, amount: reward.referrerAmount, type: 'points_issued_referral_referrer', reason: `Referral qualified (${reward.referrerAmount} pts)`, relatedReferralId: ref.id });
    } else {
      const bal = await getCreditBalance(ref.referrerCustomerId);
      await db.insert(ledger).values({
        shopifyCustomerId: ref.referrerCustomerId, currency: 'credit',
        transactionType: 'referral_qualified', amount: String(reward.referrerAmount),
        runningBalance: String(bal + reward.referrerAmount), reason: `Referral qualified ($${reward.referrerAmount} credit)`,
        relatedReferralId: ref.id,
      });
    }

    // Issue referred bonus (always points)
    await issuePoints({ customerId: referredCustomerId, amount: 500, type: 'points_issued_referral_referred', reason: 'Welcome referral bonus', relatedReferralId: ref.id });

    // Check milestones
    const { checkMilestones } = await import('@/lib/crm/milestones');
    const newMilestones = await checkMilestones(ref.referrerCustomerId);

    return { qualified: true, referralId: ref.id, tier, reward, milestones: newMilestones };
  }
);

// ─── Square: Sync Order (READ-ONLY — no writes to Square) ───

export const syncSquareOrder = inngest.createFunction(
  { id: 'sync-square-order', retries: 3, triggers: [{ event: 'square/order.synced' }] },
  async ({ event }) => {
    const { ordersProjection, customersProjection, locations } = await import('@/lib/db/schema');
    const { normalizeEmail, normalizePhone } = await import('@/lib/crm/normalize');
    const { getOrder } = await import('@/lib/square/client');
    const { issuePoints } = await import('@/lib/crm/points');

    let order = event.data.order;
    const orderId = event.data.orderId ?? order?.id;
    // Always fetch the full order from Square (READ-ONLY)
    if (orderId) {
      const { getOrder } = await import('@/lib/square/client');
      try { order = await getOrder(orderId); } catch (e) { console.error('[sync-square-order] Fetch failed:', e); return { skipped: true, reason: 'Fetch failed' }; }
    }
    if (!order?.id) return { skipped: true };
    if (order.state !== 'COMPLETED') return { skipped: true, reason: 'Not completed' };

    // Map Square location to our location
    const loc = await db.select({ id: locations.id }).from(locations)
      .where(sql`${locations.squareLocationId} = ${order.location_id}`).then(r => r[0]);

    // Match customer by Square customer_id → email/phone lookup
    let customerId: string | null = null;
    if (order.customer_id) {
      try {
        const { getCustomer } = await import('@/lib/square/client');
        const sqCust = await getCustomer(order.customer_id);
        const email = normalizeEmail(sqCust.email_address);
        const phone = normalizePhone(sqCust.phone_number);

        // Find matching customer in our DB
        const match = await db.select({ id: customersProjection.shopifyCustomerId })
          .from(customersProjection)
          .where(email ? sql`${customersProjection.email} = ${email}` : phone ? sql`${customersProjection.phone} = ${phone}` : sql`false`)
          .then(r => r[0]);

        customerId = match?.id ?? null;

        // If no match, create a projection entry
        if (!customerId && (email || phone)) {
          customerId = `sq_${order.customer_id}`;
          await db.insert(customersProjection).values({
            shopifyCustomerId: customerId,
            email, phone,
            firstName: sqCust.given_name ?? null,
            lastName: sqCust.family_name ?? null,
            orderCount: 1,
            totalSpent: order.total_money ? String(order.total_money.amount / 100) : '0',
            syncedAt: new Date(),
          }).onConflictDoNothing();
        }
      } catch (e) { console.warn('[sync-square-order] Customer lookup failed:', e); }
    }

    // Map line items
    const lineItems = (order.line_items ?? []).map((li: any) => ({
      name: li.name,
      quantity: Number(li.quantity ?? 1),
      price: li.total_money ? String(li.total_money.amount / 100) : '0',
      sku: li.catalog_object_id ?? null,
    }));

    const totalPrice = order.total_money ? String(order.total_money.amount / 100) : '0';

    // Upsert order
    await db.insert(ordersProjection).values({
      shopifyOrderId: `sq_${order.id}`,
      shopifyCustomerId: customerId,
      orderNumber: order.reference_id ?? order.id.slice(-8),
      financialStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      totalPrice,
      subtotalPrice: totalPrice,
      currency: order.total_money?.currency ?? 'CAD',
      lineItems,
      createdAt: new Date(order.created_at),
      shopifyUpdatedAt: new Date(order.updated_at),
      syncedAt: new Date(),
      source: 'square',
      locationId: loc?.id ?? null,
    }).onConflictDoUpdate({
      target: ordersProjection.shopifyOrderId,
      set: { lineItems, totalPrice, locationId: loc?.id ?? null, syncedAt: new Date(), shopifyUpdatedAt: new Date(order.updated_at) },
    });

    // Issue loyalty points (1 pt per $1)
    if (customerId) {
      const net = Math.floor(Number(totalPrice));
      if (net > 0) {
        await issuePoints({ customerId, amount: net, type: 'points_issued_purchase', reason: `${net} pts on Square order`, relatedOrderId: `sq_${order.id}` });
      }
    }

    return { synced: true, orderId: order.id, customerId };
  }
);

// ─── Square: Sync Customer (READ-ONLY) ──────────────────

export const syncSquareCustomer = inngest.createFunction(
  { id: 'sync-square-customer', retries: 3, triggers: [{ event: 'square/customer.synced' }] },
  async ({ event }) => {
    const { customersProjection } = await import('@/lib/db/schema');
    const { normalizeEmail, normalizePhone, normalizeName } = await import('@/lib/crm/normalize');

    const c = event.data.customer;
    if (!c?.id) return { skipped: true };

    const email = normalizeEmail(c.email_address);
    const phone = normalizePhone(c.phone_number);

    // Build address if present
    const address = c.address ? {
      address1: c.address.address_line_1 ?? '',
      address2: c.address.address_line_2 ?? '',
      city: c.address.locality ?? '',
      province: c.address.administrative_district_level_1 ?? '',
      zip: c.address.postal_code ?? '',
      country: c.address.country ?? '',
    } : null;

    // Build metafields from Square-specific data
    const meta: Record<string, any> = {};
    if (c.birthday) meta.birthday = c.birthday;
    if (c.note) meta.square_note = c.note;
    if (c.company_name) meta.company = c.company_name;

    // Try to find existing customer by email or phone
    const existing = await db.select({ id: customersProjection.shopifyCustomerId, metafields: customersProjection.metafields, defaultAddress: customersProjection.defaultAddress })
      .from(customersProjection)
      .where(email ? sql`${customersProjection.email} = ${email}` : phone ? sql`${customersProjection.phone} = ${phone}` : sql`false`)
      .then(r => r[0]);

    if (existing) {
      // Update with Square data (don't overwrite Shopify data, just fill gaps)
      const updates: Record<string, unknown> = { syncedAt: new Date() };
      if (!existing.id.startsWith('sq_')) return { skipped: true, reason: 'Shopify customer, skip Square update' };
      if (c.given_name) updates.firstName = normalizeName(c.given_name);
      if (c.family_name) updates.lastName = normalizeName(c.family_name);
      if (phone) updates.phone = phone;
      if (address && !existing.defaultAddress) updates.defaultAddress = address;
      if (c.preferences?.email_unsubscribed === false) updates.acceptsMarketing = true;
      if (c.preferences?.email_unsubscribed === true) updates.acceptsMarketing = false;
      // Merge metafields (fill gaps only)
      if (Object.keys(meta).length) {
        const prev = (existing.metafields as Record<string, any>) ?? {};
        const custom = prev.custom ?? {};
        const merged = { ...custom };
        if (meta.birthday && !custom.birthday) merged.birthday = meta.birthday;
        if (meta.square_note && !custom.square_note) merged.square_note = meta.square_note;
        if (meta.company && !custom.company) merged.company = meta.company;
        updates.metafields = { ...prev, custom: merged };
      }
      await db.update(customersProjection).set(updates).where(sql`${customersProjection.shopifyCustomerId} = ${existing.id}`);
      return { updated: existing.id };
    }

    // Create new
    const id = `sq_${c.id}`;
    const metafields = Object.keys(meta).length ? { custom: meta } : null;
    await db.insert(customersProjection).values({
      shopifyCustomerId: id,
      email, phone,
      firstName: normalizeName(c.given_name) ?? c.given_name ?? null,
      lastName: normalizeName(c.family_name) ?? c.family_name ?? null,
      defaultAddress: address,
      metafields,
      acceptsMarketing: c.preferences?.email_unsubscribed === false ? true : false,
      syncedAt: new Date(),
    }).onConflictDoNothing();

    return { created: id };
  }
);

// ─── VAULT Annual Gift Dispatch ──────────────────────────

export const vaultGiftDispatch = inngest.createFunction(
  { id: 'vault-gift-dispatch', retries: 1, triggers: [{ cron: '0 9 * * *' }] },
  async () => {
    const { customersProjection, giftFulfilments } = await import('@/lib/db/schema');
    const { and, sql: sqlFn } = await import('drizzle-orm');
    const { notifyStaff } = await import('@/lib/crm/notify');

    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();

    // Find VAULT members whose member_since anniversary is today
    const vaultMembers = await db.select({ id: customersProjection.shopifyCustomerId, meta: customersProjection.metafields, firstName: customersProjection.firstName, lastName: customersProjection.lastName })
      .from(customersProjection)
      .where(sqlFn`'member-vault' = ANY(tags)`);

    let dispatched = 0;
    for (const m of vaultMembers) {
      const memberSince = ((m.meta as any)?.custom?.member_since ?? '') as string;
      if (!memberSince || !memberSince.includes(`-${mm}-${dd}`)) continue;

      // Check if already dispatched this year
      const existing = await db.select().from(giftFulfilments)
        .where(and(sqlFn`${giftFulfilments.shopifyCustomerId} = ${m.id}`, sqlFn`${giftFulfilments.year} = ${year}`))
        .then(r => r[0]);
      if (existing) continue;

      await db.insert(giftFulfilments).values({ shopifyCustomerId: m.id, year });
      await notifyStaff({ title: `VAULT gift due: ${m.firstName} ${m.lastName}`, body: `Anniversary gift for ${year}. Prepare and ship.`, type: 'info', entityType: 'gift_fulfilment', entityId: m.id });
      dispatched++;
    }
    return { dispatched };
  }
);

// ─── Rx Expiry Reminders ─────────────────────────────────

export const rxExpiryReminder = inngest.createFunction(
  { id: 'rx-expiry-reminder', retries: 1, triggers: [{ cron: '0 10 * * *' }] },
  async () => {
    const { customersProjection } = await import('@/lib/db/schema');
    const { fireKlaviyoEvent } = await import('@/lib/klaviyo/events');

    const clients = await db.select({
      id: customersProjection.shopifyCustomerId,
      email: customersProjection.email,
      firstName: customersProjection.firstName,
      meta: customersProjection.metafields,
    }).from(customersProjection);

    const now = Date.now();
    const DAY = 86400000;
    let sent = 0;

    for (const c of clients) {
      if (!c.email) continue;
      const rxDate = ((c.meta as any)?.custom?.rx_last_updated ?? '') as string;
      if (!rxDate) continue;

      const expiryDate = new Date(rxDate);
      expiryDate.setMonth(expiryDate.getMonth() + 24);
      const daysUntil = Math.round((expiryDate.getTime() - now) / DAY);

      if (daysUntil === 90 || daysUntil === 60 || daysUntil === 0) {
        await fireKlaviyoEvent(c.email, 'Rx Expiry Reminder', {
          first_name: c.firstName,
          days_until_expiry: daysUntil,
          rx_date: rxDate,
          message: daysUntil === 0
            ? 'Your prescription has expired. Time for an eye exam!'
            : `Your prescription expires in ${daysUntil} days. Schedule an eye exam soon.`,
        });
        sent++;
      }
    }
    return { sent };
  }
);


// ─── Membership: Activate on purchase ────────────────────

export const activateMembership = inngest.createFunction(
  { id: 'activate-membership', retries: 2, triggers: [{ event: 'shopify/order.created' }] },
  async ({ event }) => {
    const o = event.data;
    const customerId = String(o.customer?.id ?? '');
    if (!customerId) return { skipped: true, reason: 'no customer' };

    // Check if any line item is a membership product
    const { getMembershipSkus } = await import('@/lib/crm/store-settings');
    const MEMBERSHIP_SKUS = await getMembershipSkus();
    const lineItems = (o.line_items ?? []) as Array<{ sku?: string; title?: string; product_id?: number }>;
    const membershipItem = lineItems.find(li => li.sku && MEMBERSHIP_SKUS[li.sku]);
    if (!membershipItem) return { skipped: true, reason: 'no membership item' };

    const { tier, period } = MEMBERSHIP_SKUS[membershipItem.sku!];
    const { TIERS } = await import('@/lib/crm/loyalty-config');
    const tierConfig = TIERS[tier as keyof typeof TIERS];
    if (!tierConfig) return { skipped: true, reason: `unknown tier: ${tier}` };

    // 1. Tag the customer on Shopify (idempotent)
    const { addCustomerTag } = await import('@/lib/crm/shopify-admin');
    await addCustomerTag(Number(customerId), tierConfig.tag);

    // 2. Update local projection
    const { customersProjection, creditsLedger, auditLog } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const client = await db.select({ tags: customersProjection.tags }).from(customersProjection)
      .where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);

    // Ensure tier tag is set (handles both first purchase and renewals)
    const existingTags = (client?.tags ?? []).filter(t => !t.startsWith('member-'));
    const newTags = [...existingTags, tierConfig.tag];
    await db.update(customersProjection).set({ tags: newTags, syncedAt: new Date() })
      .where(eq(customersProjection.shopifyCustomerId, customerId));

    // 3. Issue credits — monthly amount for renewals, full amount for annual first purchase
    const isRenewal = (client?.tags ?? []).includes(tierConfig.tag);
    const creditAmount = period === 'annual' && !isRenewal ? tierConfig.monthlyCredit * 12 : tierConfig.monthlyCredit;

    const lastCredit = await db.select({ balance: creditsLedger.runningBalance }).from(creditsLedger)
      .where(eq(creditsLedger.shopifyCustomerId, customerId))
      .orderBy(sql`created_at DESC`).limit(1).then(r => r[0]);
    const currentBalance = Number(lastCredit?.balance ?? 0);

    await db.insert(creditsLedger).values({
      shopifyCustomerId: customerId,
      currency: 'credit',
      transactionType: 'issued_membership',
      amount: String(creditAmount),
      runningBalance: String(currentBalance + creditAmount),
      reason: isRenewal ? `${tier.toUpperCase()} renewal — $${creditAmount} credit` : `${tier.toUpperCase()} membership activated (${period})`,
      relatedOrderId: String(o.id),
    });

    // 4. Update membership status to active
    const { updateCustomerMetafield } = await import('@/lib/crm/shopify-admin');
    await updateCustomerMetafield(Number(customerId), 'custom', 'membership_status', 'active', 'single_line_text_field').catch(() => {});

    // 5. Audit log
    await db.insert(auditLog).values({
      action: 'update', entityType: 'customer', entityId: customerId,
      staffId: 'system', surface: 'system',
      diff: { membership: { tier, period, orderId: String(o.id), isRenewal, creditAmount } },
    });

    return { activated: true, customerId, tier, period, creditAmount, isRenewal };
  }
);

// ─── Draft Order Cleanup (abandoned carts) ───────────────

export const cleanupDraftOrders = inngest.createFunction(
  { id: 'cleanup-draft-orders', name: 'Cleanup stale draft orders', retries: 1, triggers: [{ cron: '0 */6 * * *' }] },
  async () => {
    const { graphqlAdmin } = await import('@/lib/shopify/admin-graphql');

    // Find open draft orders older than 48 hours
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const query = `
      query StaleDrafts($query: String!) {
        draftOrders(first: 50, query: $query) {
          nodes { id }
        }
      }
    `;

    const result = await graphqlAdmin<{
      draftOrders: { nodes: { id: string }[] };
    }>(query, { query: `status:open created_at:<${cutoff}` });

    if (!result.ok || !result.data.draftOrders.nodes.length) return { deleted: 0 };

    const deleteMutation = `
      mutation DeleteDraft($input: DraftOrderDeleteInput!) {
        draftOrderDelete(input: $input) {
          userErrors { message }
        }
      }
    `;

    let count = 0;
    for (const draft of result.data.draftOrders.nodes) {
      const del = await graphqlAdmin(deleteMutation, { input: { id: draft.id } });
      if (del.ok) count++;
    }
    return { deleted: count };
  }
);

// ─── Draft Order Sync ────────────────────────────────────

export const syncDraftOrder = inngest.createFunction(
  { id: 'sync-draft-order', retries: 3, triggers: [{ event: 'shopify/draft_order.updated' }] },
  async ({ event }) => {
    const d = event.data;
    await db
      .insert(draftOrdersProjection)
      .values({
        shopifyDraftOrderId: String(d.id),
        shopifyCustomerId: d.customer?.id ? String(d.customer.id) : null,
        name: d.name,
        email: d.email,
        status: d.status,
        totalPrice: d.total_price,
        subtotalPrice: d.subtotal_price,
        currency: d.currency,
        lineItems: d.line_items,
        shippingAddress: d.shipping_address,
        invoiceUrl: d.invoice_url,
        orderIdOnComplete: d.order_id ? String(d.order_id) : null,
        tags: d.tags?.split(', ').filter(Boolean) ?? [],
        note: d.note,
        createdAt: d.created_at ? new Date(d.created_at) : undefined,
        shopifyUpdatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: draftOrdersProjection.shopifyDraftOrderId,
        set: {
          shopifyCustomerId: d.customer?.id ? String(d.customer.id) : null,
          name: d.name,
          email: d.email,
          status: d.status,
          totalPrice: d.total_price,
          subtotalPrice: d.subtotal_price,
          lineItems: d.line_items,
          shippingAddress: d.shipping_address,
          invoiceUrl: d.invoice_url,
          orderIdOnComplete: d.order_id ? String(d.order_id) : null,
          tags: d.tags?.split(', ').filter(Boolean) ?? [],
          note: d.note,
          shopifyUpdatedAt: d.updated_at ? new Date(d.updated_at) : undefined,
          syncedAt: new Date(),
        },
      });
    return { synced: String(d.id) };
  }
);

export const deleteDraftOrder = inngest.createFunction(
  { id: 'delete-draft-order', retries: 2, triggers: [{ event: 'shopify/draft_order.deleted' }] },
  async ({ event }) => {
    const id = String(event.data.id);
    await db.delete(draftOrdersProjection).where(eq(draftOrdersProjection.shopifyDraftOrderId, id));
    return { deleted: id };
  }
);

// ─── Export all functions ────────────────────────────────

// ─── Inventory: update stock on order events ─────────────

export const inventoryOnOrder = inngest.createFunction(
  { id: 'inventory-on-order', retries: 2, triggers: [{ event: 'shopify/order.updated' }] },
  async ({ event }) => {
    const o = event.data;
    if (!o.line_items?.length) return;

    const { resolveFrame, adjust, projectToChannels } = await import('@/lib/crm/inventory');
    const { locations: locTable } = await import('@/lib/db/schema');

    // Determine what changed
    const isNew = o.financial_status === 'paid' || o.financial_status === 'authorized';
    const isCancelled = !!o.cancelled_at;
    const isFulfilled = o.fulfillment_status === 'fulfilled';

    // Get the location for this order (use location_id from line items or default)
    const orderLocationId = o.location_id ? String(o.location_id) : null;
    let locationId: string | null = null;
    if (orderLocationId) {
      const [loc] = await db.select().from(locTable).where(eq(locTable.shopifyLocationId, orderLocationId));
      locationId = loc?.id ?? null;
    }
    if (!locationId) {
      // Fallback to first location
      const [loc] = await db.select().from(locTable).where(eq(locTable.active, true)).limit(1);
      locationId = loc?.id ?? null;
    }
    if (!locationId) return;

    for (const li of o.line_items) {
      const variantId = li.variant_id ? String(li.variant_id) : null;
      if (!variantId) continue;
      const qty = li.quantity ?? 1;

      const frame = await resolveFrame(variantId);

      if (isCancelled) {
        // Release committed stock
        await adjust({ familyId: frame.familyId, colour: frame.colour, variantId: frame.variantId, locationId, field: 'committed', delta: -qty, reason: 'return', referenceId: String(o.id), referenceType: 'shopify_order' });
      } else if (isFulfilled) {
        // Decrement on_hand + committed
        await adjust({ familyId: frame.familyId, colour: frame.colour, variantId: frame.variantId, locationId, field: 'on_hand', delta: -qty, reason: 'sale', referenceId: String(o.id), referenceType: 'shopify_order' });
        await adjust({ familyId: frame.familyId, colour: frame.colour, variantId: frame.variantId, locationId, field: 'committed', delta: -qty, reason: 'sale', referenceId: String(o.id), referenceType: 'shopify_order' });
      } else if (isNew) {
        // Reserve stock
        await adjust({ familyId: frame.familyId, colour: frame.colour, variantId: frame.variantId, locationId, field: 'committed', delta: qty, reason: 'sale', referenceId: String(o.id), referenceType: 'shopify_order' });
      }

      await projectToChannels(frame.familyId, frame.colour, frame.variantId);
    }
  }
);

export const functions = [syncCustomer, syncOrder, syncProduct, deleteProduct, syncCollection, dedupScan, monthlyCredits, birthdayCredits, creditReconciliation, dailyDigest, appointmentReminders, pointsOnPurchase, pointsBirthday, pointsExpiryScan, pointsExpiryExecute, trialConversionScan, trialReminder, referralQualify, vaultGiftDispatch, syncSquareOrder, syncSquareCustomer, rxExpiryReminder, activateMembership, cleanupDraftOrders, syncDraftOrder, deleteDraftOrder, inventoryOnOrder];
