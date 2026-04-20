'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Client {
  shopifyCustomerId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  orderCount: number | null;
  totalSpent: string | null;
  tags: string[] | null;
}

type SortKey = 'name' | 'email' | 'orders' | 'ltv';

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return <>{text.slice(0, idx)}<mark style={{ background: 'var(--crm-warning, #fef08a)', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

export default function ClientsClient() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const limit = 50;

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchClients = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);

    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (tagFilter) params.set('tag', tagFilter);
    if (sourceFilter) params.set('source', sourceFilter);
    params.set('sort', sort);
    params.set('dir', dir);
    params.set('limit', String(limit));
    params.set('offset', String((page - 1) * limit));

    try {
      const res = await fetch(`/api/crm/clients?${params}`, { credentials: 'include', signal: controller.signal });
      if (!res.ok) return;
      const d = await res.json();
      setClients(d.data ?? []);
      setTotal(d.meta?.total ?? 0);
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      setSearching(false);
      setLoading(false);
    }
  }, [debouncedQuery, tagFilter, sourceFilter, sort, dir, page]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const pages = Math.ceil(total / limit);

  function toggleSort(col: SortKey) {
    if (sort === col) setDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSort(col); setDir('desc'); }
    setPage(1);
  }

  const arrow = (col: SortKey) => sort === col ? (dir === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--crm-space-6)' }}>
        <div className="flex items-center gap-3">
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Clients</h1>
          <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>
            {loading ? '…' : total}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          <Link href="/crm/clients/duplicates" className="crm-btn crm-btn-secondary">Duplicates</Link>
          <Link href="/crm/clients/new" className="crm-btn crm-btn-primary">+ New Client</Link>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--crm-space-4)', display: 'flex', gap: 'var(--crm-space-3)' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--crm-text-tertiary)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, email, phone…"
            className="crm-input w-full"
            style={{ paddingLeft: 32, paddingRight: 32 }}
          />
          {searching && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--crm-border)', borderTopColor: 'var(--crm-text-primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          )}
        </div>
        <input
          value={tagFilter}
          onChange={e => { setTagFilter(e.target.value); setPage(1); }}
          placeholder="Filter by tag…"
          className="crm-input"
          style={{ width: 180 }}
        />
        <select
          value={sourceFilter}
          onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
          className="crm-input"
          style={{ width: 130 }}
        >
          <option value="">All sources</option>
          <option value="shopify">Shopify</option>
          <option value="square">Square</option>
        </select>
      </div>

      <div className="crm-card" style={{ overflow: 'hidden', opacity: searching ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th><button onClick={() => toggleSort('name')} style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'inherit' }}>Name{arrow('name')}</button></th>
              <th><button onClick={() => toggleSort('email')} style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'inherit' }}>Email{arrow('email')}</button></th>
              <th>Phone</th>
              <th style={{ textAlign: 'right' }}><button onClick={() => toggleSort('orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'inherit' }}>Orders{arrow('orders')}</button></th>
              <th style={{ textAlign: 'right' }}><button onClick={() => toggleSort('ltv')} style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', fontWeight: 600, color: 'inherit' }}>LTV{arrow('ltv')}</button></th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j}><div style={{ height: 14, width: j === 0 ? '60%' : '40%', background: 'var(--crm-surface-hover)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                ))}
              </tr>
            )) : clients.map(c => (
              <tr key={c.shopifyCustomerId}>
                <td>
                  <Link href={`/crm/clients/${c.shopifyCustomerId}`} style={{ fontWeight: 500, color: 'var(--crm-text-primary)' }}>
                    <Highlight text={`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—'} query={debouncedQuery} />
                  </Link>
                </td>
                <td style={{ color: 'var(--crm-text-secondary)' }}>
                  <Highlight text={c.email ?? '—'} query={debouncedQuery} />
                </td>
                <td style={{ color: 'var(--crm-text-secondary)' }}>
                  <Highlight text={c.phone ?? '—'} query={debouncedQuery} />
                </td>
                <td style={{ textAlign: 'right', color: 'var(--crm-text-secondary)' }}>{c.orderCount ?? 0}</td>
                <td style={{ textAlign: 'right', color: 'var(--crm-text-secondary)' }}>${c.totalSpent ?? '0'}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {(c.tags ?? []).filter(t => !t.startsWith('merged')).slice(0, 3).map(t => (
                      <span key={t} className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{t}</span>
                    ))}
                    {(c.tags ?? []).filter(t => !t.startsWith('merged')).length > 3 && (
                      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>+{(c.tags ?? []).filter(t => !t.startsWith('merged')).length - 3}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !clients.length && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 'var(--crm-space-12)', color: 'var(--crm-text-tertiary)' }}>No clients found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 'var(--crm-space-4)' }}>
          {page > 1 && <button onClick={() => setPage(p => p - 1)} className="crm-btn crm-btn-secondary">← Prev</button>}
          <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)', padding: '0 var(--crm-space-3)' }}>Page {page} of {pages}</span>
          {page < pages && <button onClick={() => setPage(p => p + 1)} className="crm-btn crm-btn-secondary">Next →</button>}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
