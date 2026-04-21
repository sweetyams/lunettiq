'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Referral { id: string; referrerCustomerId: string; referrerCode: string; referredCustomerId: string | null; referredEmail: string | null; status: string; referrerRewardAmount: string | null; referrerRewardCurrency: string | null; createdAt: string; fraudSignals: any; referrerName?: string }

export default function ReferralsPage() {
  const [refs, setRefs] = useState<Referral[]>([]);
  const [tab, setTab] = useState<'all' | 'flagged'>('all');

  const load = () => fetch('/api/crm/referrals', { credentials: 'include' }).then(r => r.json()).then(d => setRefs(d.data ?? []));
  useEffect(() => { load(); }, []);

  async function action(id: string, act: 'approve' | 'reject') {
    await fetch(`/api/crm/referrals/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    setRefs(prev => prev.map(r => r.id === id ? { ...r, status: act === 'approve' ? 'qualified' : 'expired' } : r));
  }

  const flagged = refs.filter(r => r.status === 'fraudulent');
  const displayed = tab === 'flagged' ? flagged : refs;
  const statusColor: Record<string, string> = { pending: '#ca8a04', qualified: '#16a34a', fraudulent: '#dc2626', expired: '#9ca3af' };

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--crm-border-light)', marginBottom: 'var(--crm-space-4)' }}>
        {(['all', 'flagged'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', fontSize: 'var(--crm-text-sm)', background: 'none', border: 'none',
            borderBottom: tab === t ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
            color: tab === t ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
            fontWeight: tab === t ? 600 : 400, cursor: 'pointer', marginBottom: -1,
          }}>
            {t === 'all' ? `All (${refs.length})` : `⚠ Flagged (${flagged.length})`}
          </button>
        ))}
      </div>

      <div className="crm-card" style={{ overflow: 'visible' }}>
        <table className="crm-table">
          <thead><tr><th>Referrer</th><th>Code</th><th>Referred</th><th>Status</th><th>Reward</th><th>Date</th>{tab === 'flagged' && <th>Signals</th>}<th></th></tr></thead>
          <tbody>
            {displayed.map(r => (
              <tr key={r.id}>
                <td><Link href={`/crm/clients/${r.referrerCustomerId}`} style={{ fontWeight: 500 }}>{(r as any).referrerName || r.referrerCustomerId.slice(-8)}</Link></td>
                <td style={{ fontFamily: 'monospace', fontSize: 'var(--crm-text-xs)' }}>{r.referrerCode}</td>
                <td>{r.referredEmail || (r.referredCustomerId ? r.referredCustomerId.slice(-8) : '—')}</td>
                <td><span style={{ color: statusColor[r.status] ?? 'inherit', fontWeight: 500, fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase' }}>{r.status}</span></td>
                <td>{r.referrerRewardAmount ? `${r.referrerRewardCurrency === 'points' ? '' : '$'}${r.referrerRewardAmount}${r.referrerRewardCurrency === 'points' ? ' pts' : ''}` : '—'}</td>
                <td style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</td>
                {tab === 'flagged' && <td style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.fraudSignals ? JSON.stringify(r.fraudSignals).slice(0, 60) : '—'}</td>}
                <td>
                  {r.status === 'fraudulent' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => action(r.id, 'approve')} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-success)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Approve</button>
                      <button onClick={() => action(r.id, 'reject')} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-error)', background: 'none', border: 'none', cursor: 'pointer' }}>Reject</button>
                    </div>
                  )}
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => action(r.id, 'approve')} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Force qualify</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!displayed.length && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>{tab === 'flagged' ? 'No flagged referrals' : 'No referrals yet'}</div>}
      </div>
    </div>
  );
}
