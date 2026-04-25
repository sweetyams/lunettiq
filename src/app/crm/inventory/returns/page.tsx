'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/crm/CrmShell';

interface Inspection {
  id: string; familyId: string; colour: string; locationId: string;
  status: string; shopifyRefundId: string | null; squareRefundId: string | null;
  inspectedBy: string | null; inspectedAt: string | null; notes: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  awaiting: { bg: '#fef3c7', color: '#92400e' },
  sellable: { bg: '#95FFB9', color: '#065f46' },
  damaged: { bg: '#fef2f2', color: '#dc2626' },
  refurbish: { bg: '#dbeafe', color: '#1e40af' },
  written_off: { bg: '#f3f4f6', color: '#6b7280' },
};

export default function ReturnsPage() {
  const { toast } = useToast();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'awaiting' | 'all'>('awaiting');
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/inventory/returns${filter === 'awaiting' ? '?status=awaiting' : ''}`, { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/settings/locations', { credentials: 'include' }).then(r => r.json()),
    ]).then(([r, l]) => {
      setInspections(r.data ?? []);
      setLocations(l.data ?? []);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [filter]);

  async function resolve(id: string, status: string) {
    await fetch('/api/crm/inventory/returns', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', id, status, notes: notes || undefined }),
    });
    toast(`Marked as ${status}`);
    setResolving(null); setNotes(''); load();
  }

  const locName = (id: string) => locations.find(l => l.id === id)?.name ?? id;
  const frameName = (i: Inspection) => `${i.familyId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} — ${i.colour.replace(/-/g, ' ')}`;

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13 }}>
        <Link href="/crm/inventory" style={{ color: '#9ca3af', textDecoration: 'none' }}>Inventory</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontWeight: 600 }}>Returns</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Return Inspections</h1>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['awaiting', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: filter === f ? '#111' : '#f3f4f6', color: filter === f ? '#fff' : '#6b7280', fontWeight: filter === f ? 600 : 400,
            }}>{f === 'awaiting' ? 'Pending' : 'All'}</button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Loading…</div> : inspections.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No {filter === 'awaiting' ? 'pending' : ''} return inspections.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {inspections.map(i => {
            const st = STATUS_STYLES[i.status] ?? STATUS_STYLES.awaiting;
            const isResolving = resolving === i.id;
            return (
              <div key={i.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{frameName(i)}</span>
                    <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color, fontWeight: 600 }}>{i.status}</span>
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#9ca3af' }}>at {locName(i.locationId)}</span>
                  </div>
                  {i.status === 'awaiting' && !isResolving && (
                    <button onClick={() => setResolving(i.id)} className="crm-btn crm-btn-primary" style={{ fontSize: 10, padding: '3px 10px' }}>Inspect</button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                  {new Date(i.createdAt).toLocaleString()}
                  {i.shopifyRefundId && <span> · Shopify refund {i.shopifyRefundId}</span>}
                  {i.squareRefundId && <span> · Square refund {i.squareRefundId}</span>}
                  {i.notes && <span> · {i.notes}</span>}
                </div>

                {isResolving && (
                  <div style={{ marginTop: 8, padding: 10, background: '#fafafa', borderRadius: 8, border: '1px dashed #d1d5db' }}>
                    <input className="crm-input" style={{ width: '100%', fontSize: 11, marginBottom: 8 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Inspection notes (optional)" />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => resolve(i.id, 'sellable')} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: '#95FFB9', color: '#065f46', fontWeight: 600 }}>Sellable</button>
                      <button onClick={() => resolve(i.id, 'damaged')} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>Damaged</button>
                      <button onClick={() => resolve(i.id, 'refurbish')} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>Refurbish</button>
                      <button onClick={() => resolve(i.id, 'written_off')} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: '#f3f4f6', color: '#6b7280', fontWeight: 600 }}>Write Off</button>
                      <button onClick={() => { setResolving(null); setNotes(''); }} style={{ fontSize: 10, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
