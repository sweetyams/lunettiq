import { requirePermission, getCrmSession } from '@/lib/crm/auth';
import { hasPermission } from '@/lib/crm/permissions';
import { getLocationScope, applyLocationFilter } from '@/lib/crm/location-scope';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';
import { desc, eq, and, gte, lte, sql, type SQL } from 'drizzle-orm';
import Link from 'next/link';

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string; action?: string; entityType?: string; actor?: string; dateFrom?: string; dateTo?: string };
}) {
  const session = await requirePermission('org:audit:read_own_location');
  const canReadAll = hasPermission(session.role, 'org:audit:read_all');

  const page = Math.max(1, Number(searchParams.page ?? 1));
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  // Location scoping — managers see only their locations
  if (!canReadAll) {
    const scope = getLocationScope(session);
    const locFilter = applyLocationFilter(auditLog.locationId as any, scope);
    if (locFilter) conditions.push(locFilter);
  }

  if (searchParams.action) conditions.push(eq(auditLog.action, searchParams.action as any));
  if (searchParams.entityType) conditions.push(eq(auditLog.entityType, searchParams.entityType));
  if (searchParams.actor) conditions.push(eq(auditLog.staffId, searchParams.actor));
  if (searchParams.dateFrom) conditions.push(gte(auditLog.createdAt, new Date(searchParams.dateFrom)));
  if (searchParams.dateTo) conditions.push(lte(auditLog.createdAt, new Date(searchParams.dateTo)));

  const where = conditions.length ? and(...conditions) : undefined;

  const [entries, countResult] = await Promise.all([
    db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(auditLog).where(where),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const pages = Math.ceil(total / limit);

  function filterUrl(overrides: Record<string, string>) {
    const p = { ...searchParams, page: '1', ...overrides };
    return `/crm/settings/audit?${new URLSearchParams(p).toString()}`;
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: 'var(--crm-text-primary)' }}>
          Audit Log
        </h1>
        <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>
          {total} entries
        </span>
      </div>

      {/* Filters */}
      <form style={{ display: 'flex', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-5)', flexWrap: 'wrap' }}>
        <select name="action" defaultValue={searchParams.action ?? ''} className="crm-input" style={{ width: 'auto' }}>
          <option value="">All actions</option>
          {['create', 'update', 'delete', 'login', 'consent_change', 'tag_change', 'credit_adjustment', 'sync'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input name="entityType" defaultValue={searchParams.entityType ?? ''} placeholder="Entity type" className="crm-input" style={{ width: 160 }} />
        <input name="actor" defaultValue={searchParams.actor ?? ''} placeholder="Actor ID" className="crm-input" style={{ width: 160 }} />
        <input name="dateFrom" type="date" defaultValue={searchParams.dateFrom ?? ''} className="crm-input" style={{ width: 'auto' }} />
        <input name="dateTo" type="date" defaultValue={searchParams.dateTo ?? ''} className="crm-input" style={{ width: 'auto' }} />
        <button type="submit" className="crm-btn crm-btn-primary">Filter</button>
        <Link href="/crm/settings/audit" className="crm-btn crm-btn-secondary">Clear</Link>
      </form>

      {/* Table */}
      <div className="crm-card" style={{ overflow: 'hidden' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Surface</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td style={{ color: 'var(--crm-text-secondary)', whiteSpace: 'nowrap' }}>
                  {e.createdAt ? new Date(e.createdAt).toISOString().slice(0, 16).replace('T', ' ') : ''}
                </td>
                <td>
                  <span className="crm-badge" style={{
                    background: e.status === 'denied' ? 'var(--crm-error-light, #fef2f2)' : 'var(--crm-surface-hover)',
                    color: e.status === 'denied' ? 'var(--crm-error, #dc2626)' : 'var(--crm-text-secondary)',
                  }}>
                    {e.action}
                  </span>
                </td>
                <td style={{ color: 'var(--crm-text-secondary)' }}>{e.entityType} / {e.entityId.slice(0, 12)}</td>
                <td style={{ color: 'var(--crm-text-secondary)' }}>{e.staffId?.slice(0, 12) ?? 'system'}</td>
                <td style={{ color: 'var(--crm-text-tertiary)' }}>{e.actorRole ?? '—'}</td>
                <td style={{ color: 'var(--crm-text-tertiary)' }}>{e.surface}</td>
                <td style={{ color: 'var(--crm-text-tertiary)' }}>{e.locationId ?? '—'}</td>
              </tr>
            ))}
            {!entries.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--crm-space-12)', color: 'var(--crm-text-tertiary)' }}>
                  No audit entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 'var(--crm-space-4)' }}>
          {page > 1 && <Link href={filterUrl({ page: String(page - 1) })} className="crm-btn crm-btn-secondary">← Prev</Link>}
          <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', padding: '0 var(--crm-space-3)' }}>
            Page {page} of {pages}
          </span>
          {page < pages && <Link href={filterUrl({ page: String(page + 1) })} className="crm-btn crm-btn-secondary">Next →</Link>}
        </div>
      )}
    </div>
  );
}
