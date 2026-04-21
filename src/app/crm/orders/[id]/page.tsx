import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { ordersProjection, customersProjection, productMappings, productsProjection } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  await requirePermission('org:orders:read');
  const order = await db.select().from(ordersProjection).where(eq(ordersProjection.shopifyOrderId, params.id)).then(r => r[0]);
  if (!order) notFound();

  const customer = order.shopifyCustomerId
    ? await db.select().from(customersProjection).where(eq(customersProjection.shopifyCustomerId, order.shopifyCustomerId)).then(r => r[0])
    : null;

  const lineItems = (order.lineItems ?? []) as Array<{ name?: string; title?: string; quantity?: number; price?: string; image?: { src: string }; mappedTitle?: string; mappingStatus?: string }>;

  // Enrich Square line items with Shopify product images via mappings
  if (source === 'square') {
    const mappings = await db.execute(sql`
      SELECT m.square_name, m.status, p.title, p.images::jsonb->0->>'src' as image_url
      FROM product_mappings m
      JOIN products_projection p ON p.shopify_product_id = m.shopify_product_id
      WHERE m.status IN ('confirmed', 'auto', 'manual', 'related')
    `);
    const mapByName = new Map<string, { title: string; imageUrl: string | null; status: string }>();
    for (const m of mappings.rows as any[]) {
      if (m.square_name) mapByName.set(m.square_name.toLowerCase(), { title: m.title, imageUrl: m.image_url, status: m.status });
    }
    for (const li of lineItems) {
      const match = mapByName.get((li.name ?? '').toLowerCase());
      if (match) {
        if (match.imageUrl) li.image = { src: match.imageUrl };
        li.mappedTitle = match.title;
        li.mappingStatus = match.status;
      }
    }
  }
  const shipping = order.shippingAddress as { name?: string; address1?: string; city?: string; province?: string; zip?: string; country?: string } | null;
  const source = (order.source ?? 'shopify') as 'shopify' | 'square';
  const isSquare = source === 'square';

  const badgeStyle = (s: string | null) => {
    if (s === 'paid' || s === 'fulfilled') return { background: 'var(--crm-success-light)', color: 'var(--crm-success)' };
    if (s === 'refunded') return { background: 'var(--crm-error-light)', color: 'var(--crm-error)' };
    return { background: 'var(--crm-warning-light)', color: 'var(--crm-warning)' };
  };

  // Square order IDs are stored as sq_<id> — strip prefix for admin URL
  const adminLink = isSquare
    ? `https://squareup.com/dashboard/sales/transactions/${order.shopifyOrderId.replace(/^sq_/, '')}`
    : `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN}/admin/orders/${order.shopifyOrderId}`;

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 960 }}>
      <Link href={customer ? `/crm/clients/${customer.shopifyCustomerId}` : '/crm/clients'}
        className="crm-btn crm-btn-ghost" style={{ padding: 0, marginBottom: 'var(--crm-space-3)', display: 'inline-flex' }}>
        ← {customer ? `${customer.firstName} ${customer.lastName}` : 'Clients'}
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--crm-space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Order #{order.orderNumber}</h1>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 'var(--crm-radius-sm)', background: isSquare ? '#f3f0ff' : '#f0f7ff', color: isSquare ? '#6d28d9' : '#2563eb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{source}</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)', alignItems: 'center' }}>
          {order.createdAt && <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>{new Date(order.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>}
          <span className="crm-badge" style={badgeStyle(order.financialStatus)}>{order.financialStatus}</span>
          <span className="crm-badge" style={badgeStyle(order.fulfillmentStatus)}>{order.fulfillmentStatus || 'unfulfilled'}</span>
          <a href={adminLink}
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginLeft: 'var(--crm-space-2)' }}>
            View in {isSquare ? 'Square' : 'Shopify'} ↗
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--crm-space-6)' }}>
        {/* LEFT: Line items + totals */}
        <div>
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-4)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
              {lineItems.map((li, i) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--crm-space-3)', alignItems: 'center', padding: 'var(--crm-space-3)', background: 'var(--crm-bg)', borderRadius: 'var(--crm-radius-md)' }}>
                  <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 'var(--crm-radius-sm)', overflow: 'hidden', background: 'var(--crm-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {li.image?.src
                      ? <img src={li.image.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>No img</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{li.mappedTitle ?? li.name ?? li.title}</div>
                    {li.mappedTitle && li.name && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 1 }}>{li.name}{li.mappingStatus === 'related' ? ' · related' : ''}</div>}
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>Qty {li.quantity ?? 1}</div>
                  </div>
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, flexShrink: 0 }}>${li.price ?? '0'}</div>
                </div>
              ))}
            </div>
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
