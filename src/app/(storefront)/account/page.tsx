import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile, getCustomerOrders, getCustomerMetafield } from '@/lib/shopify/customer';
import type { LoyaltyData } from '@/types/customer';
import LoyaltySection from '@/components/account/LoyaltySection';
import AccountPersonalization from '@/components/account/AccountPersonalization';
import ProfileEditor from '@/components/account/ProfileEditor';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const accessToken = getAccessToken();

  let profile = null;
  let orders = null;
  let loyalty: LoyaltyData | null = null;

  // Dev bypass
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) {
    const { db } = await import('@/lib/db');
    const { customersProjection } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    const c = await db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, process.env.DEV_CUSTOMER_ID)).then(r => r[0]);
    if (c) {
      profile = { id: c.shopifyCustomerId, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, defaultAddress: c.defaultAddress as any, addresses: [] };
      const { getTierFromTags } = await import('@/lib/crm/loyalty-config');
      const tier = getTierFromTags(c.tags ?? null);
      if (tier) {
        const { creditsLedger } = await import('@/lib/db/schema');
        const { desc, and } = await import('drizzle-orm');
        const lastCredit = await db.select({ balance: creditsLedger.runningBalance }).from(creditsLedger)
          .where(and(eq(creditsLedger.shopifyCustomerId, process.env.DEV_CUSTOMER_ID!), eq(creditsLedger.currency, 'credit')))
          .orderBy(desc(creditsLedger.createdAt)).limit(1).then(r => r[0]);
        loyalty = { tier: tier as LoyaltyData['tier'], points: Number(lastCredit?.balance ?? 0), nextTierThreshold: tier === 'vault' ? 0 : tier === 'cult' ? 5000 : 2000 };
      }
      // Load orders from DB
      const { ordersProjection } = await import('@/lib/db/schema');
      const { desc } = await import('drizzle-orm');
      const dbOrders = await db.select().from(ordersProjection).where(eq(ordersProjection.shopifyCustomerId, process.env.DEV_CUSTOMER_ID!)).orderBy(desc(ordersProjection.processedAt)).limit(10);
      orders = dbOrders.map(o => ({
        id: o.shopifyOrderId, name: `#${o.orderNumber}`, processedAt: o.processedAt?.toISOString() ?? '',
        financialStatus: o.financialStatus ?? 'paid', fulfillmentStatus: o.fulfillmentStatus ?? '',
        totalPrice: { amount: o.totalPrice ?? '0', currencyCode: o.currency ?? 'CAD' },
        lineItems: ((o.lineItems ?? []) as any[]).map(li => ({ title: li.name ?? '', quantity: li.quantity ?? 1, variant: null })),
      }));
    }
  } else {
    try { profile = await getCustomerProfile(accessToken ?? undefined); } catch {}
    try { orders = await getCustomerOrders(10, accessToken ?? undefined); } catch {}
    try { loyalty = await getCustomerMetafield<LoyaltyData>('custom', 'loyalty', accessToken ?? undefined); } catch {}
  }

  return (
    <div className="site-container py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-medium">My Account</h1>
        <Link
          href="/api/auth/logout"
          className="text-sm text-gray-500 hover:text-black transition-colors"
        >
          Sign Out
        </Link>
      </div>

      {/* Profile Section */}
      <section className="mb-10">
        <h2 className="text-lg font-medium mb-4">Profile</h2>
        {profile ? (
          <ProfileEditor
            initial={{ firstName: profile.firstName, lastName: profile.lastName, email: profile.email, phone: profile.phone }}
            loyaltyBadge={loyalty ? (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">Membership</p>
                <p className="text-sm">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${
                    loyalty.tier === 'vault' ? 'bg-black text-white' : loyalty.tier === 'cult' ? 'bg-amber-400 text-black' : 'bg-gray-200 text-black'
                  }`}>◆ {loyalty.tier.toUpperCase()}</span>
                  {loyalty.points > 0 && <span className="text-gray-500">{loyalty.points} points</span>}
                </p>
              </div>
            ) : undefined}
          />
        ) : (
          <div className="border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-500 mb-3">Complete your profile to get personalized recommendations.</p>
            <Link href="/account/prescriptions" className="text-sm underline hover:text-black">Add your prescription</Link>
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section className="mb-10 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Link href="/account/loyalty" className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors text-center">
          <span className="text-lg">◆</span><p className="text-sm mt-1">Membership</p>
        </Link>
        <Link href="/account/points" className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors text-center">
          <span className="text-lg">✦</span><p className="text-sm mt-1">Points</p>
        </Link>
        <Link href="/account/referrals" className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors text-center">
          <span className="text-lg">↗</span><p className="text-sm mt-1">Referrals</p>
        </Link>
        <Link
          href="/account/appointments"
          className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors text-center"
        >
          <span className="text-lg">📅</span>
          <p className="text-sm mt-1">Appointments</p>
        </Link>
        <Link
          href="/account/wishlist"
          className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors text-center"
        >
          <span className="text-lg">♡</span>
          <p className="text-sm mt-1">Wishlist</p>
        </Link>
        <Link
          href="/account/prescriptions"
          className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors text-center"
        >
          <span className="text-lg">📋</span>
          <p className="text-sm mt-1">Prescriptions</p>
        </Link>
        <Link
          href="/pages/stores"
          className="border border-gray-200 rounded-lg p-4 hover:border-black transition-colors text-center"
        >
          <span className="text-lg">📍</span>
          <p className="text-sm mt-1">Find a Store</p>
        </Link>
      </section>

      {/* Loyalty Section */}
      <section className="mb-10">
        <LoyaltySection loyalty={loyalty} />
      </section>

      {/* Personalization panels */}
      <AccountPersonalization />

      {/* Order History */}
      <section>
        <h2 className="text-lg font-medium mb-4">Order History</h2>
        {orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/account/orders/${order.id}`} className="block border border-gray-200 rounded-lg p-4 hover:border-black transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{order.name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(order.processedAt).toLocaleDateString('en-CA')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 capitalize">
                    {order.financialStatus.toLowerCase().replace(/_/g, ' ')}
                  </span>
                  <span>
                    {new Intl.NumberFormat('en-CA', {
                      style: 'currency',
                      currency: order.totalPrice.currencyCode || 'CAD',
                    }).format(Number(order.totalPrice.amount))}
                  </span>
                </div>
                {order.lineItems.length > 0 && (
                  <div className="mt-3 text-xs text-gray-500">
                    {order.lineItems.map((item, i) => (
                      <span key={i}>
                        {item.title} × {item.quantity}
                        {i < order.lineItems.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-500 mb-4">You haven't placed any orders yet.</p>
            <Link href="/collections/optics" className="inline-block px-6 py-2.5 bg-black text-white text-sm rounded-full hover:bg-gray-800 transition-colors">
              Shop Eyewear
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
