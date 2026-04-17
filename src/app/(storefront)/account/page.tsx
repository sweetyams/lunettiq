import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile, getCustomerOrders, getCustomerMetafield } from '@/lib/shopify/customer';
import type { LoyaltyData } from '@/types/customer';
import LoyaltySection from '@/components/account/LoyaltySection';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const accessToken = getAccessToken();

  let profile = null;
  let orders = null;
  let loyalty: LoyaltyData | null = null;

  try {
    profile = await getCustomerProfile(accessToken ?? undefined);
  } catch {
    // handled in UI
  }

  try {
    orders = await getCustomerOrders(10, accessToken ?? undefined);
  } catch {
    // handled in UI
  }

  try {
    loyalty = await getCustomerMetafield<LoyaltyData>('custom', 'loyalty', accessToken ?? undefined);
  } catch {
    // handled in UI
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
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
          <div className="border border-gray-200 rounded-lg p-6 space-y-2">
            <p className="text-sm">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="text-sm text-gray-500">{profile.email}</p>
            {profile.phone && <p className="text-sm text-gray-500">{profile.phone}</p>}
            {profile.defaultAddress && (
              <p className="text-sm text-gray-500">
                {profile.defaultAddress.address1}, {profile.defaultAddress.city},{' '}
                {profile.defaultAddress.province} {profile.defaultAddress.zip}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Unable to load profile.</p>
        )}
      </section>

      {/* Quick Links */}
      <section className="mb-10 grid grid-cols-1 sm:grid-cols-4 gap-4">
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

      {/* Order History */}
      <section>
        <h2 className="text-lg font-medium mb-4">Order History</h2>
        {orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="border border-gray-200 rounded-lg p-4">
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
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No orders yet.</p>
        )}
      </section>
    </div>
  );
}
