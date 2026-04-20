export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  customersProjection, preferencesDerived, creditsLedger,
  interactions, ordersProjection, loyaltyTiers,
} from '@/lib/db/schema';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile, getCustomerMetafield } from '@/lib/shopify/customer';
import { getTierFromTags } from '@/lib/crm/loyalty-config';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { PrescriptionRecord } from '@/types/customer';

export interface MemberContext {
  customerId: string;
  tier: string | null;
  stated: { shapes?: string[]; materials?: string[]; colours?: string[]; avoid?: string[] };
  derived: { shapes?: Record<string, number>; materials?: Record<string, number>; colours?: Record<string, number>; priceRange?: { min?: number; max?: number; avg?: number } } | null;
  fit: { faceShape?: string; frameWidthMm?: number; bridgeWidthMm?: number; templeLengthMm?: number; rxOnFile?: boolean } | null;
  rx: { latestDate?: string; expiresApprox?: string; daysUntilExpiry?: number } | null;
  creditBalance: number;
  creditExpiry: string | null;
  recommendations: { productId: string; staffName?: string; date: string }[];
  orderCount: number;
  namedOptician: string | null;
  lensRefresh: boolean;
  tradeInRate: number;
  lastOrderDate: string | null;
  referralCount: number;
}

const EMPTY: MemberContext = {
  customerId: '', tier: null, stated: {}, derived: null, fit: null, rx: null,
  creditBalance: 0, creditExpiry: null, recommendations: [], orderCount: 0,
  namedOptician: null, lensRefresh: false, tradeInRate: 0, lastOrderDate: null, referralCount: 0,
};

export async function GET() {
  // Resolve customer ID
  let customerId: string | null = null;
  let accessToken: string | null = null;

  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) {
    customerId = process.env.DEV_CUSTOMER_ID;
  } else {
    accessToken = getAccessToken();
    if (!accessToken) return NextResponse.json({ data: null });
    try {
      const profile = await getCustomerProfile(accessToken);
      customerId = profile.id.replace(/^gid:\/\/shopify\/Customer\//, '');
    } catch {
      return NextResponse.json({ data: null });
    }
  }

  // Parallel data fetch
  const [client, derived, creditRow, recs, lastOrder, rxData, referralCount] = await Promise.all([
    db.select({ tags: customersProjection.tags, metafields: customersProjection.metafields, orderCount: customersProjection.orderCount })
      .from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]),
    db.select().from(preferencesDerived).where(eq(preferencesDerived.shopifyCustomerId, customerId)).then(r => r[0]),
    db.select({ balance: creditsLedger.runningBalance, expiresAt: creditsLedger.expiresAt })
      .from(creditsLedger)
      .where(and(eq(creditsLedger.shopifyCustomerId, customerId), eq(creditsLedger.currency, 'credit')))
      .orderBy(desc(creditsLedger.createdAt)).limit(1).then(r => r[0]),
    db.select({ metadata: interactions.metadata, staffId: interactions.staffId, occurredAt: interactions.occurredAt })
      .from(interactions)
      .where(and(eq(interactions.shopifyCustomerId, customerId), eq(interactions.type, 'product_recommendation')))
      .orderBy(desc(interactions.occurredAt)).limit(20),
    db.select({ processedAt: ordersProjection.processedAt })
      .from(ordersProjection)
      .where(eq(ordersProjection.shopifyCustomerId, customerId))
      .orderBy(desc(ordersProjection.processedAt)).limit(1).then(r => r[0]),
    getCustomerMetafield<{ records: PrescriptionRecord[] }>('custom', 'prescriptions', accessToken ?? undefined).catch(() => null),
    db.execute(sql`SELECT count(*)::int as c FROM referrals WHERE referrer_customer_id = ${customerId} AND status = 'qualified'`).then(r => (r.rows[0] as any)?.c ?? 0),
  ]);

  if (!client) return NextResponse.json({ data: null });

  const tier = getTierFromTags(client.tags ?? null);
  const meta = ((client.metafields as Record<string, Record<string, string>> | null)?.custom) ?? {};

  // Stated prefs
  let stated: MemberContext['stated'] = {};
  try { stated = meta.preferences_json ? JSON.parse(meta.preferences_json) : {}; } catch {}

  // Fit profile
  const fit: MemberContext['fit'] = (meta.face_shape || meta.frame_width_mm) ? {
    faceShape: meta.face_shape || undefined,
    frameWidthMm: meta.frame_width_mm ? Number(meta.frame_width_mm) : undefined,
    bridgeWidthMm: meta.bridge_width_mm ? Number(meta.bridge_width_mm) : undefined,
    templeLengthMm: meta.temple_length_mm ? Number(meta.temple_length_mm) : undefined,
    rxOnFile: meta.rx_on_file === 'true',
  } : null;

  // Rx
  const rxRecords = rxData?.records ?? [];
  const latestRx = rxRecords.sort((a, b) => b.date.localeCompare(a.date))[0];
  let rx: MemberContext['rx'] = null;
  if (latestRx) {
    const rxDate = new Date(latestRx.date);
    const expiresApprox = new Date(rxDate);
    expiresApprox.setFullYear(expiresApprox.getFullYear() + 2);
    const daysUntilExpiry = Math.ceil((expiresApprox.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    rx = { latestDate: latestRx.date, expiresApprox: expiresApprox.toISOString().slice(0, 10), daysUntilExpiry };
  }

  // Derived prefs
  const derivedCtx: MemberContext['derived'] = derived ? {
    shapes: derived.derivedShapes as Record<string, number> | undefined,
    materials: derived.derivedMaterials as Record<string, number> | undefined,
    colours: derived.derivedColours as Record<string, number> | undefined,
    priceRange: derived.derivedPriceRange as { min?: number; max?: number; avg?: number } | undefined,
  } : null;

  // Recommendations
  const recommendations = recs.map(r => {
    const m = r.metadata as { productId?: string; productTitle?: string } | null;
    return { productId: m?.productId ?? '', staffName: r.staffId ?? undefined, date: r.occurredAt?.toISOString().slice(0, 10) ?? '' };
  }).filter(r => r.productId);

  // Tier-specific fields
  let namedOptician: string | null = null;
  let lensRefresh = false;
  let tradeInRate = 0;
  if (tier) {
    const tierRow = await db.select({ namedOptician: loyaltyTiers.namedOptician, lensRefresh: loyaltyTiers.lensRefresh, tradeInRate: loyaltyTiers.tradeInRate })
      .from(loyaltyTiers).where(eq(loyaltyTiers.id, tier)).then(r => r[0]);
    if (tierRow) {
      namedOptician = tierRow.namedOptician ? (meta.named_optician ?? null) : null;
      lensRefresh = tierRow.lensRefresh ?? false;
      tradeInRate = Number(tierRow.tradeInRate ?? 0);
    }
  }

  const data: MemberContext = {
    customerId,
    tier,
    stated,
    derived: derivedCtx,
    fit,
    rx,
    creditBalance: Number(creditRow?.balance ?? 0),
    creditExpiry: creditRow?.expiresAt?.toISOString().slice(0, 10) ?? null,
    recommendations,
    orderCount: client.orderCount ?? 0,
    namedOptician,
    lensRefresh,
    tradeInRate,
    lastOrderDate: lastOrder?.processedAt?.toISOString().slice(0, 10) ?? null,
    referralCount,
  };

  return NextResponse.json({ data });
}
