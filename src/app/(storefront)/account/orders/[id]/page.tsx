import { db } from '@/lib/db';
import { ordersProjection } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAccessToken } from '@/lib/shopify/auth';
import { getCustomerProfile } from '@/lib/shopify/customer';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  let customerId: string | null = null;
  if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) {
    customerId = process.env.DEV_CUSTOMER_ID;
  } else {
    const token = getAccessToken();
    if (token) { try { customerId = (await getCustomerProfile(token)).id.replace(/^gid:\/\/shopify\/Customer\//, ''); } catch {} }
  }
  if (!customerId) return <div className="max-w-3xl mx-auto px-6 py-12"><p className="text-sm text-gray-500">Please sign in.</p></div>;

  const order = await db.select().from(ordersProjection)
    .where(eq(ordersProjection.shopifyOrderId, params.id))
    .then(r => r[0]);

  if (!order || order.shopifyCustomerId !== customerId) notFound();

  const lineItems = (order.lineItems ?? []) as Array<{ name?: string; quantity?: number; price?: string; product_id?: number }>;
  const shipping = order.shippingAddress as { address1?: string; address2?: string; city?: string; province?: string; zip?: string; country?: string; phone?: string } | null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/account" className="text-sm text-gray-400 hover:text-black">← My Account</Link>

      <div className="flex items-center justify-between mt-4 mb-8">
        <h1 className="text-2xl font-medium">Order #{order.orderNumber}</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          order.financialStatus === 'paid' ? 'bg-green-100 text-green-700' :
          order.financialStatus === 'refunded' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {(order.financialStatus ?? 'pending').replace(/_/g, ' ')}
        </span>
      </div>

      {/* Items */}
      <section className="border border-gray-200 rounded-lg mb-6">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-medium">Items</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {lineItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-gray-400">Qty: {item.quantity ?? 1}</p>
              </div>
              <p className="text-sm">${Number(item.price ?? 0).toFixed(2)}</p>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <span className="text-sm font-medium">Total</span>
          <span className="text-sm font-medium">
            {new Intl.NumberFormat('en-CA', { style: 'currency', currency: order.currency ?? 'CAD' }).format(Number(order.totalPrice ?? 0))}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Shipping address */}
        <section className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium mb-3">Shipping Address</h2>
          {shipping ? (
            <div className="text-sm text-gray-500 space-y-0.5">
              {shipping.address1 && <p>{shipping.address1}</p>}
              {shipping.address2 && <p>{shipping.address2}</p>}
              <p>{[shipping.city, shipping.province, shipping.zip].filter(Boolean).join(', ')}</p>
              {shipping.country && <p>{shipping.country}</p>}
              {shipping.phone && <p className="mt-2">{shipping.phone}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-300">No shipping address</p>
          )}
        </section>

        {/* Order details */}
        <section className="border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium mb-3">Details</h2>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Order date</span>
              <span>{order.processedAt ? new Date(order.processedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Payment</span>
              <span className="capitalize">{(order.financialStatus ?? 'pending').replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fulfillment</span>
              <span className="capitalize">{(order.fulfillmentStatus ?? 'unfulfilled').replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Subtotal</span>
              <span>${Number(order.subtotalPrice ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{new Intl.NumberFormat('en-CA', { style: 'currency', currency: order.currency ?? 'CAD' }).format(Number(order.totalPrice ?? 0))}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Help */}
      <div className="mt-6 text-center text-sm text-gray-400">
        <p>Need help with this order? <Link href="/pages/stores" className="underline hover:text-black">Contact us</Link></p>
      </div>
    </div>
  );
}
