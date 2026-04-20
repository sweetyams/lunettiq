'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/crm/CrmShell';

interface Entry {
  id: string;
  type: string;
  summary: string;
  date: string;
  details?: { productImageUrl?: string; metadata?: { productId?: string } };
}

const FILTERS = ['All', 'Orders', 'Notes', 'Calls', 'Credits', 'Appointments'] as const;
const FILTER_MAP: Record<string, string> = { Orders: 'order', Notes: 'note', Calls: 'call', Credits: 'credit', Appointments: 'appointment' };
const ICONS: Record<string, string> = {
  order: '🛍️', note: '📝', call: '📞', visit: '🏪', credit: '💰', appointment: '📅', product_recommendation: '👓',
};

export function ActivityTimeline({ customerId }: { customerId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const { toast } = useToast();

  const fetchEntries = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'All') params.set('filter', FILTER_MAP[filter] ?? filter.toLowerCase());
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/crm/clients/${customerId}/timeline?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load timeline');
      const json = await res.json();
      const d = json.data ?? json;
      const items = d.data ?? d.entries ?? d ?? [];
      setEntries(prev => cursor ? [...prev, ...items] : items);
      setNextCursor(d.nextCursor ?? null);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [customerId, filter, toast]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return (
    <div>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 'var(--crm-space-2)', marginBottom: 'var(--crm-space-4)', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px', borderRadius: 'var(--crm-radius-md)', fontSize: 'var(--crm-text-xs)', cursor: 'pointer', border: 'none',
              background: filter === f ? 'var(--crm-accent)' : 'var(--crm-bg)',
              color: filter === f ? '#fff' : 'var(--crm-text-secondary)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2)' }}>
        {entries.map(e => {
          const editable = ['note', 'call', 'visit'].includes(e.type);
          return (
            <div key={e.id} className="crm-card" style={{ padding: 'var(--crm-space-3)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', position: 'relative' }}>
              <span style={{ fontSize: 18 }}>{ICONS[e.type] ?? '📌'}</span>
              {e.details?.productImageUrl && (
                <img src={e.details.productImageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === e.id ? (
                  <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
                    <input value={editText} onChange={ev => setEditText(ev.target.value)} className="crm-input" style={{ flex: 1, fontSize: 'var(--crm-text-sm)' }} autoFocus
                      onKeyDown={async ev => { if (ev.key === 'Enter') { await fetch(`/api/crm/interactions/${e.id.replace('int-', '')}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: editText }) }); setEditingId(null); fetchEntries(); } }} />
                    <button onClick={() => setEditingId(null)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 'var(--crm-text-sm)' }}>{e.summary}</div>
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{e.date ? new Date(e.date).toLocaleDateString('en-CA') : ''}</div>
                  </>
                )}
              </div>
              {editable && editingId !== e.id && (
                <div style={{ display: 'flex', gap: 2, opacity: 0.3 }} className="hover-show">
                  <button onClick={() => { setEditingId(e.id); setEditText(e.summary); }} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>edit</button>
                  <button onClick={async () => { if (confirm('Delete this entry?')) { await fetch(`/api/crm/interactions/${e.id.replace('int-', '')}`, { method: 'DELETE', credentials: 'include' }); fetchEntries(); } }} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-error)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              )}
            </div>
          );
        })}
        {!loading && !entries.length && (
          <p style={{ textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)', padding: 'var(--crm-space-6) 0' }}>No activity yet</p>
        )}
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)', marginTop: 'var(--crm-space-4)' }}>Loading…</p>}

      {nextCursor && !loading && (
        <button onClick={() => fetchEntries(nextCursor)} className="crm-btn crm-btn-secondary" style={{ marginTop: 'var(--crm-space-4)', width: '100%' }}>
          Load more
        </button>
      )}
    </div>
  );
}
