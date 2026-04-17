import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { customersProjection, ordersProjection, productsProjection } from '@/lib/db/schema';
import { sql, desc, gte } from 'drizzle-orm';
import Link from 'next/link';

export default async function CrmDashboardPage() {
  await requirePermission('org:clients:read');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalClients, ordersThisMonth, revenueThisMonth, totalProducts, recentClients] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(customersProjection).then(r => Number(r[0]?.count ?? 0)),
    db.select({ count: sql<number>`count(*)` }).from(ordersProjection).where(gte(ordersProjection.createdAt, monthStart)).then(r => Number(r[0]?.count ?? 0)),
    db.select({ total: sql<string>`coalesce(sum(${ordersProjection.totalPrice}), 0)` }).from(ordersProjection).where(gte(ordersProjection.createdAt, monthStart)).then(r => r[0]?.total ?? '0'),
    db.select({ count: sql<number>`count(*)` }).from(productsProjection).then(r => Number(r[0]?.count ?? 0)),
    db.select().from(customersProjection).orderBy(desc(customersProjection.syncedAt)).limit(10),
  ]);

  const kpis = [
    { label: 'Total Clients', value: totalClients.toLocaleString() },
    { label: 'Orders This Month', value: ordersThisMonth.toLocaleString() },
    { label: 'Revenue This Month', value: `$${Number(revenueThisMonth).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
    { label: 'Products', value: totalProducts.toLocaleString() },
  ];

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 1100 }}>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-6)' }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-8)' }}>
        {kpis.map(k => (
          <div key={k.label} className="crm-card" style={{ padding: 'var(--crm-space-5)' }}>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, marginTop: 'var(--crm-space-1)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 'var(--crm-text-base)', fontWeight: 500, marginBottom: 'var(--crm-space-3)' }}>Recent Clients</h2>
      <div className="crm-card" style={{ overflow: 'hidden' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th style={{ textAlign: 'right' }}>Orders</th>
              <th style={{ textAlign: 'right' }}>Total Spent</th>
              <th style={{ textAlign: 'right' }}>Synced</th>
            </tr>
          </thead>
          <tbody>
            {recentClients.map(c => (
              <tr key={c.shopifyCustomerId}>
                <td>
                  <Link href={`/crm/clients/${c.shopifyCustomerId}`} style={{ fontWeight: 500, textDecoration: 'none', color: 'var(--crm-text-primary)' }}>
                    {c.firstName} {c.lastName}
                  </Link>
                </td>
                <td style={{ color: 'var(--crm-text-secondary)' }}>{c.email}</td>
                <td style={{ textAlign: 'right' }}>{c.orderCount ?? 0}</td>
                <td style={{ textAlign: 'right' }}>${c.totalSpent ?? '0'}</td>
                <td style={{ textAlign: 'right', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>
                  {c.syncedAt ? new Date(c.syncedAt).toISOString().slice(0, 10) : '—'}
                </td>
              </tr>
            ))}
            {!recentClients.length && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--crm-text-tertiary)', padding: 'var(--crm-space-8)' }}>No clients yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
