import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { customersProjection, ordersProjection, productsProjection, productVariantsProjection, appointments, interactions, secondSightIntakes, productFamilies, productFamilyMembers } from '@/lib/db/schema';
import { sql, desc, gte, and, eq, lt } from 'drizzle-orm';
import Link from 'next/link';

export default async function CrmDashboardPage() {
  await requirePermission('org:clients:read');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86400000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

  const [
    totalClients, newClientsThisMonth, newClientsPrevMonth,
    ordersThisMonth, ordersPrevMonth,
    revenueThisMonth, revenuePrevMonth,
    todayAppointments, weekAppointments,
    pendingIntakes,
    recentOrders,
    topClients,
    lowStock,
    familyStats,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customersProjection).then(r => Number(r[0]?.count ?? 0)),
    db.select({ count: sql<number>`count(*)` }).from(customersProjection).where(gte(customersProjection.createdAt, monthStart)).then(r => Number(r[0]?.count ?? 0)),
    db.select({ count: sql<number>`count(*)` }).from(customersProjection).where(and(gte(customersProjection.createdAt, prevMonthStart), lt(customersProjection.createdAt, monthStart))).then(r => Number(r[0]?.count ?? 0)),
    db.select({ count: sql<number>`count(*)` }).from(ordersProjection).where(gte(ordersProjection.createdAt, monthStart)).then(r => Number(r[0]?.count ?? 0)),
    db.select({ count: sql<number>`count(*)` }).from(ordersProjection).where(and(gte(ordersProjection.createdAt, prevMonthStart), lt(ordersProjection.createdAt, monthStart))).then(r => Number(r[0]?.count ?? 0)),
    db.select({ total: sql<string>`coalesce(sum(${ordersProjection.totalPrice}), 0)` }).from(ordersProjection).where(gte(ordersProjection.createdAt, monthStart)).then(r => r[0]?.total ?? '0'),
    db.select({ total: sql<string>`coalesce(sum(${ordersProjection.totalPrice}), 0)` }).from(ordersProjection).where(and(gte(ordersProjection.createdAt, prevMonthStart), lt(ordersProjection.createdAt, monthStart))).then(r => r[0]?.total ?? '0'),
    db.select({ count: sql<number>`count(*)` }).from(appointments).where(and(gte(appointments.startsAt, todayStart), lt(appointments.startsAt, todayEnd), eq(appointments.status, 'scheduled'))).then(r => Number(r[0]?.count ?? 0)),
    db.select().from(appointments).where(and(gte(appointments.startsAt, todayStart), lt(appointments.startsAt, weekEnd))).orderBy(appointments.startsAt).limit(5),
    db.select({ count: sql<number>`count(*)` }).from(secondSightIntakes).where(eq(secondSightIntakes.status, 'submitted')).then(r => Number(r[0]?.count ?? 0)),
    db.execute(sql`
      SELECT o.shopify_order_id, o.order_number, o.total_price, o.financial_status, o.created_at,
             c.first_name, c.last_name, c.shopify_customer_id
      FROM orders_projection o
      LEFT JOIN customers_projection c ON c.shopify_customer_id = o.shopify_customer_id
      ORDER BY o.created_at DESC LIMIT 8
    `).then(r => r.rows),
    db.execute(sql`
      SELECT c.shopify_customer_id, c.first_name, c.last_name, c.email,
             c.order_count, c.total_spent
      FROM customers_projection c
      WHERE c.total_spent IS NOT NULL
      ORDER BY c.total_spent::numeric DESC LIMIT 5
    `).then(r => r.rows),
    // Low stock
    db.execute(sql`
      SELECT p.title, p.slug, sum(v.inventory_quantity)::int as stock
      FROM products_projection p
      JOIN product_variants_projection v ON v.shopify_product_id = p.shopify_product_id
      WHERE p.status = 'active'
      GROUP BY p.shopify_product_id, p.title, p.slug
      HAVING sum(v.inventory_quantity) BETWEEN 0 AND 5
      ORDER BY sum(v.inventory_quantity) ASC
      LIMIT 6
    `).then(r => r.rows),
    // Family stats
    db.execute(sql`
      SELECT f.id, f.name, count(m.product_id)::int as products,
             count(DISTINCT m.colour)::int as colours,
             count(DISTINCT CASE WHEN m.type = 'sun' THEN m.product_id END)::int as sun_count,
             count(DISTINCT CASE WHEN m.type = 'optical' THEN m.product_id END)::int as optical_count
      FROM product_families f
      JOIN product_family_members m ON m.family_id = f.id
      JOIN products_projection p ON p.shopify_product_id = m.product_id AND p.status = 'active'
      GROUP BY f.id, f.name
      ORDER BY products DESC LIMIT 8
    `).then(r => r.rows),
  ]);

  function delta(current: number, previous: number): { pct: string; up: boolean } | null {
    if (!previous) return current > 0 ? { pct: '+∞', up: true } : null;
    const d = ((current - previous) / previous) * 100;
    return { pct: `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`, up: d >= 0 };
  }

  const revDelta = delta(Number(revenueThisMonth), Number(revenuePrevMonth));
  const orderDelta = delta(ordersThisMonth, ordersPrevMonth);
  const clientDelta = delta(newClientsThisMonth, newClientsPrevMonth);

  const kpis = [
    { label: 'Revenue', value: `$${Number(revenueThisMonth).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, sub: 'this month', delta: revDelta, href: '/crm/reports/sales' },
    { label: 'Orders', value: ordersThisMonth.toLocaleString(), sub: 'this month', delta: orderDelta, href: '/crm/orders' },
    { label: 'New Clients', value: newClientsThisMonth.toLocaleString(), sub: `of ${totalClients.toLocaleString()} total`, delta: clientDelta, href: '/crm/clients' },
    { label: 'Today', value: String(todayAppointments), sub: `appointment${todayAppointments !== 1 ? 's' : ''}`, delta: null, href: '/crm/appointments' },
  ];

  const statusColor: Record<string, string> = { paid: '#16a34a', pending: '#f59e0b', refunded: '#6b7280', partially_refunded: '#f59e0b' };

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--crm-space-6)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Dashboard</h1>
        <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
          {now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* KPIs */}
      <div className="crm-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-6)' }}>
        {kpis.map(k => (
          <Link key={k.label} href={k.href} className="crm-card crm-kpi" style={{ padding: 'var(--crm-space-5)', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
              {k.delta && (
                <span className="crm-delta" style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 10, background: k.delta.up ? '#dcfce7' : '#fef2f2', color: k.delta.up ? '#16a34a' : '#dc2626' }}>
                  {k.delta.pct}
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, marginTop: 'var(--crm-space-1)' }}>{k.value}</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>{k.sub}</div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--crm-space-4)' }}>
        {/* Left column */}
        <div className="crm-dash-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
          {/* Recent Orders */}
          <div className="crm-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 'var(--crm-space-4) var(--crm-space-4) var(--crm-space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Recent Orders</h2>
              <Link href="/crm/orders" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>View all →</Link>
            </div>
            <table className="crm-table crm-table-animated">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(recentOrders as any[]).map(o => (
                  <tr key={o.shopify_order_id}>
                    <td style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>#{o.order_number}</td>
                    <td>
                      {o.shopify_customer_id ? (
                        <Link href={`/crm/clients/${o.shopify_customer_id}`} style={{ textDecoration: 'none', color: 'var(--crm-text-primary)' }}>
                          {o.first_name} {o.last_name}
                        </Link>
                      ) : <span style={{ color: 'var(--crm-text-tertiary)' }}>Guest</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${Number(o.total_price).toFixed(0)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="crm-status-badge" style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: `${statusColor[o.financial_status] ?? '#6b7280'}18`, color: statusColor[o.financial_status] ?? '#6b7280' }}>
                        {o.financial_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top Clients */}
          <div className="crm-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: 'var(--crm-space-4) var(--crm-space-4) var(--crm-space-2)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Top Clients</h2>
            </div>
            <table className="crm-table crm-table-animated">
              <thead>
                <tr>
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Orders</th>
                  <th style={{ textAlign: 'right' }}>Lifetime</th>
                </tr>
              </thead>
              <tbody>
                {(topClients as any[]).map(c => (
                  <tr key={c.shopify_customer_id}>
                    <td>
                      <Link href={`/crm/clients/${c.shopify_customer_id}`} style={{ fontWeight: 500, textDecoration: 'none', color: 'var(--crm-text-primary)' }}>
                        {c.first_name} {c.last_name}
                      </Link>
                      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{c.email}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{c.order_count ?? 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>${Number(c.total_spent ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="crm-dash-section" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4)' }}>
          {/* Upcoming Appointments */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Upcoming</h2>
              <Link href="/crm/appointments" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>Calendar →</Link>
            </div>
            {weekAppointments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
                {weekAppointments.map(a => {
                  const d = new Date(a.startsAt);
                  const isToday = d.toDateString() === now.toDateString();
                  return (
                    <div key={a.id} style={{ display: 'flex', gap: 'var(--crm-space-3)', alignItems: 'flex-start' }}>
                      <div className={isToday ? 'crm-today-pulse' : ''} style={{ minWidth: 44, textAlign: 'center', padding: '4px 0', borderRadius: 8, background: isToday ? 'var(--crm-accent)' : 'var(--crm-surface-hover)', color: isToday ? '#fff' : 'var(--crm-text-secondary)' }}>
                        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.toLocaleDateString('en-CA', { weekday: 'short' })}</div>
                        <div style={{ fontSize: 'var(--crm-text-base)', fontWeight: 600 }}>{d.getDate()}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                          {d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: a.status === 'confirmed' ? '#dcfce7' : 'var(--crm-surface-hover)', color: a.status === 'confirmed' ? '#16a34a' : 'var(--crm-text-tertiary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {a.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', padding: 'var(--crm-space-4) 0', textAlign: 'center' }}>No upcoming appointments</div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="crm-card" style={{ padding: 'var(--crm-space-4)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-3)' }}>Quick Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'New Appointment', href: '/crm/appointments/new', icon: '📅' },
                { label: 'Second Sight Intake', href: '/crm/second-sight/new', icon: '👓', badge: pendingIntakes > 0 ? pendingIntakes : null },
                { label: 'New Client', href: '/crm/clients/new', icon: '👤' },
                { label: 'Product Analysis', href: '/crm/reports/product-analysis', icon: '📊' },
              ].map(a => (
                <Link key={a.href} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2)', padding: '8px 10px', borderRadius: 8, textDecoration: 'none', color: 'var(--crm-text-primary)', fontSize: 'var(--crm-text-sm)', transition: 'background 100ms' }} className="crm-hover-surface crm-action-link">
                  <span>{a.icon}</span>
                  <span style={{ flex: 1 }}>{a.label}</span>
                  {a.badge && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10, background: '#fef3c7', color: '#92400e' }}>{a.badge}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Product Intelligence Row */}
      <div className="crm-dash-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-4)', marginTop: 'var(--crm-space-4)' }}>
        {/* Low Stock Alert */}
        <div className="crm-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 'var(--crm-space-4) var(--crm-space-4) var(--crm-space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>⚠️ Low Stock</h2>
            <Link href="/crm/products" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>All products →</Link>
          </div>
          {(lowStock as any[]).length > 0 ? (
            <div style={{ padding: '0 var(--crm-space-4) var(--crm-space-4)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(lowStock as any[]).map(p => (
                  <div key={p.slug} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--crm-border-light)' }}>
                    <span style={{ fontSize: 'var(--crm-text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.title}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, marginLeft: 8, whiteSpace: 'nowrap', background: p.stock === 0 ? '#fef2f2' : '#fffbeb', color: p.stock === 0 ? '#dc2626' : '#d97706' }}>
                      {p.stock === 0 ? 'Out' : `${p.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>All stocked ✓</div>
          )}
        </div>

        {/* Family Overview */}
        <div className="crm-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 'var(--crm-space-4) var(--crm-space-4) var(--crm-space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Families</h2>
            <Link href="/crm/products?view=families" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>Manage →</Link>
          </div>
          <div style={{ padding: '0 var(--crm-space-4) var(--crm-space-4)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(familyStats as any[]).map(f => (
                <Link key={f.id} href={`/crm/products/families/${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--crm-border-light)', textDecoration: 'none', color: 'inherit', fontSize: 'var(--crm-text-xs)', transition: 'border-color 150ms var(--ease-out)' }} className="crm-hover-surface">
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span style={{ color: 'var(--crm-text-tertiary)' }}>{f.colours}c</span>
                  {f.sun_count > 0 && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>☀</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
