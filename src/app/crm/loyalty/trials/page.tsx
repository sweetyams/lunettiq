import { requirePermission } from '@/lib/crm/auth';
import { db } from '@/lib/db';
import { membershipTrials, customersProjection } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';

export default async function TrialsPage() {
  await requirePermission('org:membership:read');

  const rows = await db.select({
    trial: membershipTrials,
    firstName: customersProjection.firstName,
    lastName: customersProjection.lastName,
    email: customersProjection.email,
  }).from(membershipTrials)
    .leftJoin(customersProjection, eq(membershipTrials.shopifyCustomerId, customersProjection.shopifyCustomerId))
    .orderBy(desc(membershipTrials.startedAt)).limit(100);

  const outcomeColor: Record<string, string> = { pending: 'var(--crm-warning)', converted: 'var(--crm-success)', cancelled: 'var(--crm-text-tertiary)', clawback_applied: 'var(--crm-error)' };

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div className="crm-card" style={{ overflow: 'hidden' }}>
        <table className="crm-table">
          <thead><tr><th>Customer</th><th>Tier</th><th>Started</th><th>Converts</th><th>Credits Used</th><th>Outcome</th><th>Clawback</th></tr></thead>
          <tbody>
            {rows.map(r => {
              const daysLeft = r.trial.outcome === 'pending' && r.trial.convertsAt ? Math.max(0, Math.round((new Date(r.trial.convertsAt).getTime() - Date.now()) / 86400000)) : null;
              return (
                <tr key={r.trial.id}>
                  <td><Link href={`/crm/clients/${r.trial.shopifyCustomerId}`} style={{ fontWeight: 500 }}>{[r.firstName, r.lastName].filter(Boolean).join(' ') || r.email || r.trial.shopifyCustomerId.slice(-8)}</Link></td>
                  <td style={{ textTransform: 'uppercase', fontSize: 'var(--crm-text-xs)', fontWeight: 600 }}>{r.trial.tier}</td>
                  <td style={{ fontSize: 'var(--crm-text-xs)' }}>{r.trial.startedAt ? new Date(r.trial.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</td>
                  <td style={{ fontSize: 'var(--crm-text-xs)' }}>{daysLeft !== null ? `${daysLeft}d left` : r.trial.convertsAt ? new Date(r.trial.convertsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</td>
                  <td>${r.trial.creditsUsedDuringTrial ?? '0'}</td>
                  <td><span style={{ color: outcomeColor[r.trial.outcome ?? ''] ?? 'inherit', fontWeight: 500, fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase' }}>{r.trial.outcome}</span></td>
                  <td>{r.trial.clawbackAmount ? `$${r.trial.clawbackAmount}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>No trials yet</div>}
      </div>
    </div>
  );
}
