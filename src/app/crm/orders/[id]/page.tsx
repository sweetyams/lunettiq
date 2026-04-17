import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { ordersProjection, customersProjection } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  await requirePermission('org:orders:read');
  const order = await db.select().from(ordersProjection).where(eq(ordersProjection.shopifyOrderId, params.id)).then(r => r[0]);
  if (!order) notFound();

  const customer = order.shopifyCustomerId
    ? await db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, order.shopifyCustomerId)).then(r => r[0])
    : null;

  const lineItems = (order.lineItems ?? []) as Array<{ name?: string; title?: string; quantity?: number; price?: string }>;
  const shipping = order.shippingAddress as { name?: string; address1?: string; city?: string; province?: string; zip?: string; country?: string } | null;

  const badgeStyle = (s: string | null) => {
    if (s === 'paid' || s === 'fulfilled') return { background: 'var(--crm-success-light)', color: 'var(--crm-success)' };
    if (s === 'refunded') return { background: 'var(--crm-error-light)', color: 'var(--crm-error)' };
    return { background: 'var(--crm-warning-light)', color: 'var(--crm-warning)' };
  };

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 960 }}>
      <Link href={customer ? `/crm/clients/${customer.shopifyCustomerId}` : '/crm/clients'}
        className="crm-btn crm-btn-ghost" style={{ padding: 0, marginBottom: 'var(--crm-space-3)', display: 'inline-flex' }}>
        ← {customer ? `${customer.firstName} ${customer.lastName}` : 'Clients'}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-6)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Order #{order.orderNumber}</h1>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          <span className="crm-badge" style={badgeStyle(order.financialStatus)}>{order.financialStatus}</span>
          <span className="crm-badge" style={badgeStyle(order.fulfillmentStatus)}>{order.fulfillmentStatus || 'unfulfilled'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--crm-space-6)' }}>
        {/* LEFT: Line items + totals */}
        <div>
          <div className="crm-card" style={{ overflow: 'hidden', marginBottom: 'var(--crm-space-4)' }}>
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, i) => (
                  <tr key={i}>
                    <td>{li.name || li.title}</td>
                    <td style={{ textAlign: 'right' }}>{li.quantity ?? 1}</td>
                    <td style={{ textAlign: 'right' }}>${li.price ?? '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)' }}>
              <span>Subtotal</span><span>${order.subtotalPrice}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginTop: 'var(--crm-space-2)', paddingTop: 'var(--crm-space-2)', borderTop: '1px solid var(--crm-border-light)' }}>
              <span>Total</span><span>${order.totalPrice} {order.currency}</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Customer + Shipping */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h3 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, marginBottom: 'var(--crm-space-2)' }}>Customer</h3>
            {customer ? (
              <div style={{ fontSize: 'var(--crm-text-sm)' }}>
                <Link href={`/crm/clients/${customer.shopifyCustomerId}`} style={{ fontWeight: 500, textDecoration: 'none', color: 'var(--crm-text-primary)' }}>
                  {customer.firstName} {customer.lastName}
                </Link>
                <div style={{ color: 'var(--crm-text-secondary)', marginTop: 2 }}>{customer.email}</div>
                {customer.phone && <div style={{ color: 'var(--crm-text-secondary)' }}>{customer.phone}</div>}
                <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 'var(--crm-space-2)' }}>
                  {customer.orderCount} orders · ${customer.totalSpent} LTV
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No customer linked</p>
            )}
          </div>

          {shipping?.address1 && (
            <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
              <h3 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, marginBottom: 'var(--crm-space-2)' }}>Shipping</h3>
              <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', lineHeight: 1.6 }}>
                {shipping.name && <div>{shipping.name}</div>}
                <div>{shipping.address1}</div>
                <div>{[shipping.city, shipping.province, shipping.zip].filter(Boolean).join(', ')}</div>
                <div>{shipping.country}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
