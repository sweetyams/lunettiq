export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { db } from '@/lib/db';
import { customersProjection, ordersProjection } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * GET /api/account/me
 * Returns customer identity + properties for client-side tracking.
 * Returns null if not logged in.
 */
export async function GET() {
  try {
    let customerId: string | null = null;

    if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) {
      customerId = process.env.DEV_CUSTOMER_ID;
    } else {
      const token = getAccessToken();
      if (!token) return NextResponse.json({ data: null });
      const profile = await getCustomerProfile(token);
      customerId = profile.id.replace(/^gid:\/\/shopify\/Customer\//, '');
    }

    // Fetch enriched data from projection
    const [customer] = await db.select({
      firstName: customersProjection.firstName,
      lastName: customersProjection.lastName,
      email: customersProjection.email,
      tags: customersProjection.tags,
      city: customersProjection.city,
      createdAt: customersProjection.createdAt,
    }).from(customersProjection)
      .where(eq(customersProjection.shopifyCustomerId, customerId))
      .limit(1);

    if (!customer) return NextResponse.json({ data: null });

    // Aggregate order stats
    const [stats] = await db.select({
      totalOrders: sql<number>`count(*)::int`,
      lifetimeValue: sql<number>`coalesce(sum(${ordersProjection.totalPrice}::numeric), 0)::float`,
    }).from(ordersProjection)
      .where(eq(ordersProjection.shopifyCustomerId, customerId));

    // Extract tier from tags
    const tags = customer.tags ?? [];
    const tierTag = tags.find(t => t?.startsWith('tier:'));
    const tier = tierTag?.replace('tier:', '') ?? null;
    const hasMembership = tags.some(t => t === 'membership:active');

    return NextResponse.json({
      data: {
        id: customerId,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        tier,
        hasMembership,
        lifetimeValue: stats?.lifetimeValue ?? 0,
        totalOrders: stats?.totalOrders ?? 0,
        city: customer.city,
        joinedAt: customer.createdAt?.toISOString() ?? null,
      },
    });
  } catch {
    return NextResponse.json({ data: null });
  }
}
