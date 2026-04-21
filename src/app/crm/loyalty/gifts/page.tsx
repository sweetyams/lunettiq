'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Gift { id: string; shopifyCustomerId: string; customerName: string; year: number; status: string; giftDescription: string | null; trackingNumber: string | null; shippedAt: string | null }

export default function GiftsPage() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const load = () => fetch('/api/crm/loyalty/gifts', { credentials: 'include' }).then(r => r.json()).then(d => setGifts(d.data ?? []));
  useEffect(() => { load(); }, []);

  async function update(id: string, updates: Record<string, unknown>) {
    await fetch('/api/crm/loyalty/gifts', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
    load();
  }

  const statusColor: Record<string, string> = { pending: '#ca8a04', sourcing: '#2563eb', shipped: '#16a34a', delivered: '#16a34a' };

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div className="crm-card" style={{ overflow: 'hidden' }}>
        <table className="crm-table">
          <thead><tr><th>Member</th><th>Year</th><th>Status</th><th>Gift</th><th>Tracking</th><th>Actions</th></tr></thead>
          <tbody>
            {gifts.map(g => (
              <tr key={g.id}>
                <td><Link href={`/crm/clients/${g.shopifyCustomerId}`} style={{ fontWeight: 500 }}>{g.customerName || g.shopifyCustomerId.slice(-8)}</Link></td>
                <td>{g.year}</td>
                <td><span style={{ color: statusColor[g.status] ?? 'inherit', fontWeight: 500, fontSize: 'var(--crm-text-xs)', textTransform: 'uppercase' }}>{g.status}</span></td>
                <td style={{ fontSize: 'var(--crm-text-xs)' }}>{g.giftDescription || '—'}</td>
                <td style={{ fontSize: 'var(--crm-text-xs)', fontFamily: 'monospace' }}>{g.trackingNumber || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {g.status === 'pending' && <button onClick={() => update(g.id, { status: 'sourcing' })} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Start sourcing</button>}
                    {g.status === 'sourcing' && <button onClick={() => { const t = prompt('Tracking number:'); if (t) update(g.id, { status: 'shipped', trackingNumber: t }); }} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Mark shipped</button>}
                    {g.status === 'shipped' && <button onClick={() => update(g.id, { status: 'delivered' })} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-success)', background: 'none', border: 'none', cursor: 'pointer' }}>Delivered</button>}
                    {!g.giftDescription && <button onClick={() => { const d = prompt('Gift description:'); if (d) update(g.id, { giftDescription: d }); }} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Add description</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!gifts.length && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>No gifts dispatched yet</div>}
      </div>
    </div>
  );
}
