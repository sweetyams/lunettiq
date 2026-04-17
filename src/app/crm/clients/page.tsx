import { db } from '@/lib/db';
import { customersProjection } from '@/lib/db/schema';
import { desc, asc, ilike, or, sql } from 'drizzle-orm';
import Link from 'next/link';
import { requirePermission } from '@/lib/crm/auth';

const SORT_COLS = {
  name: customersProjection.lastName,
  email: customersProjection.email,
  orders: customersProjection.orderCount,
  ltv: customersProjection.totalSpent,
} as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string; tag?: string; page?: string; sort?: string; dir?: string };
}) {
  await requirePermission('org:clients:read');
  const search = searchParams.q ?? '';
  const tag = searchParams.tag;
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const sortKey = searchParams.sort ?? 'name';
  const sortDir = searchParams.dir === 'asc' ? 'asc' : 'desc';
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  // Hide merged customers
  conditions.push(sql`NOT EXISTS (SELECT 1 FROM unnest(COALESCE(${customersProjection.tags}, '{}')) AS t(v) WHERE v LIKE 'merged%')`);
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(
      ilike(customersProjection.firstName, pattern),
      ilike(customersProjection.lastName, pattern),
      ilike(customersProjection.email, pattern),
      ilike(customersProjection.phone, pattern),
    ));
  }
  if (tag) conditions.push(sql`${tag} = ANY(${customersProjection.tags})`);
  const where = conditions.length ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

  const sortCol = SORT_COLS[sortKey as keyof typeof SORT_COLS] ?? customersProjection.lastName;
  const orderFn = sortDir === 'asc' ? asc(sortCol) : desc(sortCol);

  const [clients, countResult] = await Promise.all([
    db.select().from(customersProjection).where(where).orderBy(orderFn).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(customersProjection).where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const pages = Math.ceil(total / limit);

  function sortUrl(col: string) {
    const newDir = sortKey === col && sortDir === 'desc' ? 'asc' : 'desc';
    return `/crm/clients?q=${search}&tag=${tag ?? ''}&sort=${col}&dir=${newDir}&page=1`;
  }

  const arrow = (col: string) => sortKey === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--crm-space-6)' }}>
        <div className="flex items-center gap-3">
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>
            Clients
          </h1>
          <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>
            {total}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          <Link href="/crm/clients/duplicates" className="crm-btn crm-btn-secondary">Duplicates</Link>
          <Link href="/crm/clients/new" className="crm-btn crm-btn-primary">+ New Client</Link>
        </div>
      </div>

      {/* Search */}
      <form style={{ marginBottom: 'var(--crm-space-4)' }}>
        <div className="relative w-full">
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--crm-text-tertiary)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            name="q"
            defaultValue={search}
            placeholder="Search by name, email, phone…"
            className="crm-input w-full"
            style={{ paddingLeft: 32 }}
          />
        </div>
      </form>

      {/* Table */}
      <div className="crm-card" style={{ overflow: 'hidden' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th><Link href={sortUrl('name')}>Name{arrow('name')}</Link></th>
              <th><Link href={sortUrl('email')}>Email{arrow('email')}</Link></th>
              <th>Phone</th>
              <th style={{ textAlign: 'right' }}><Link href={sortUrl('orders')}>Orders{arrow('orders')}</Link></th>
              <th style={{ textAlign: 'right' }}><Link href={sortUrl('ltv')}>LTV{arrow('ltv')}</Link></th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.shopifyCustomerId}>
                <td>
                  <Link
                    href={`/crm/clients/${c.shopifyCustomerId}`}
                    style={{ fontWeight: 500, color: 'var(--crm-text-primary)' }}
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                </td>
                <td style={{ color: 'var(--crm-text-secondary)' }}>{c.email ?? '—'}</td>
                <td style={{ color: 'var(--crm-text-secondary)' }}>{c.phone ?? '—'}</td>
                <td style={{ textAlign: 'right', color: 'var(--crm-text-secondary)' }}>{c.orderCount ?? 0}</td>
                <td style={{ textAlign: 'right', color: 'var(--crm-text-secondary)' }}>${c.totalSpent ?? '0'}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {(c.tags ?? []).filter(t => !t.startsWith('merged')).slice(0, 3).map(t => (
                      <span key={t} className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>
                        {t}
                      </span>
                    ))}
                    {(c.tags ?? []).filter(t => !t.startsWith('merged')).length > 3 && (
                      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                        +{(c.tags ?? []).filter(t => !t.startsWith('merged')).length - 3}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!clients.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--crm-space-12)', color: 'var(--crm-text-tertiary)' }}>
                  No clients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 'var(--crm-space-4)' }}>
          {page > 1 && (
            <Link
              href={`/crm/clients?q=${search}&tag=${tag ?? ''}&sort=${sortKey}&dir=${sortDir}&page=${page - 1}`}
              className="crm-btn crm-btn-secondary"
            >
              ← Prev
            </Link>
          )}
          <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', padding: '0 var(--crm-space-3)' }}>
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link
              href={`/crm/clients?q=${search}&tag=${tag ?? ''}&sort=${sortKey}&dir=${sortDir}&page=${page + 1}`}
              className="crm-btn crm-btn-secondary"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
