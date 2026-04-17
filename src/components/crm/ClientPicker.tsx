'use client';

import { useState, useEffect, useCallback } from 'react';

interface ClientResult {
  id: string; firstName: string | null; lastName: string | null;
  email: string | null; phone: string | null; tags: string[] | null;
}

interface Segment { id: string; name: string; memberCount: number | null; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (client: { id: string; name: string }) => void;
  multi?: boolean;
  onSelectMulti?: (clients: Array<{ id: string; name: string }>) => void;
}

export function ClientPicker({ open, onClose, onSelect, multi, onSelectMulti }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<string, { id: string; name: string }>>(new Map());
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState('');

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setSelected(new Map()); setSegmentId(''); return; }
    fetch('/api/crm/segments', { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) setSegments((d.data ?? []) as Segment[]);
    });
  }, [open]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      if (segmentId) {
        const res = await fetch(`/api/crm/segments/${segmentId}/members`, { credentials: 'include' });
        if (res.ok) {
          const d = await res.json();
          let members = (d.data ?? d) as ClientResult[];
          if (query) {
            const q = query.toLowerCase();
            members = members.filter(c =>
              [c.firstName, c.lastName, c.email, c.phone].some(f => f?.toLowerCase().includes(q))
            );
          }
          setResults(members);
        }
      } else {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        params.set('limit', '50');
        const res = await fetch(`/api/crm/clients?${params}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setResults((data.data ?? data.clients ?? []).map((c: any) => ({
            id: c.shopifyCustomerId, firstName: c.firstName, lastName: c.lastName,
            email: c.email, phone: c.phone, tags: c.tags,
          })));
        }
      }
    } finally { setLoading(false); }
  }, [query, segmentId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(fetchClients, 150);
    return () => clearTimeout(t);
  }, [fetchClients, open]);

  const filtered = results.filter(c => !(c.tags ?? []).some(t => t.startsWith('merged')));

  function toggleClient(c: ClientResult) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
    if (!multi) { onSelect({ id: c.id, name }); onClose(); return; }
    const next = new Map(selected);
    if (next.has(c.id)) next.delete(c.id); else next.set(c.id, { id: c.id, name });
    setSelected(next);
  }

  function selectAll() {
    if (selected.size === filtered.length) { setSelected(new Map()); return; }
    const next = new Map<string, { id: string; name: string }>();
    filtered.forEach(c => next.set(c.id, { id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' ') }));
    setSelected(next);
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', overflow: 'hidden', zIndex: 50 }}>
        {/* Header */}
        <div style={{ padding: 'var(--crm-space-4)', borderBottom: '1px solid var(--crm-border)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
          <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search by name, email, or phone…"
            className="crm-input" style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
            <select value={segmentId} onChange={e => { setSegmentId(e.target.value); }} className="crm-input" style={{ flex: 1 }}>
              <option value="">All clients</option>
              {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.memberCount ?? 0})</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {multi && filtered.length > 0 && (
            <button onClick={selectAll} style={{ width: '100%', padding: '8px var(--crm-space-4)', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'var(--crm-bg)', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              {selected.size === filtered.length ? 'Deselect all' : `Select all (${filtered.length})`}
            </button>
          )}
          {loading && !results.length && <div style={{ padding: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Loading…</div>}
          {!loading && !filtered.length && (
            <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No clients found</div>
          )}
          {filtered.map(c => {
            const isSelected = selected.has(c.id);
            return (
              <button key={c.id} onClick={() => toggleClient(c)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px var(--crm-space-4)', textAlign: 'left', fontSize: 'var(--crm-text-sm)', background: isSelected ? 'var(--crm-surface-hover)' : 'transparent', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', fontFamily: 'var(--crm-font)' }}>
                {multi && (
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: isSelected ? 'none' : '1.5px solid var(--crm-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isSelected ? 'var(--crm-text-primary)' : 'none', transition: 'all 0.15s' }}>
                    {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="var(--crm-surface)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{c.firstName} {c.lastName}</div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[c.email, c.phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {(c.tags ?? []).filter(t => !t.startsWith('merged')).length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {(c.tags ?? []).filter(t => !t.startsWith('merged')).slice(0, 2).map(t => (
                      <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: 'var(--crm-bg)', color: 'var(--crm-text-tertiary)', borderRadius: 'var(--crm-radius-sm)' }}>{t}</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: 'var(--crm-space-3) var(--crm-space-4)', borderTop: '1px solid var(--crm-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
            {multi ? `${selected.size} selected` : `${filtered.length} clients`}
          </span>
          <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
            <button onClick={onClose} className="crm-btn crm-btn-secondary">Cancel</button>
            {multi && (
              <button onClick={() => { onSelectMulti?.(Array.from(selected.values())); onClose(); }} disabled={!selected.size}
                className="crm-btn crm-btn-primary" style={{ opacity: selected.size ? 1 : 0.4 }}>
                Confirm ({selected.size})
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
