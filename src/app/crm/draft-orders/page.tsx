'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface DraftOrder {
  shopifyDraftOrderId: string; shopifyCustomerId: string | null; name: string | null;
  email: string | null; status: string | null; totalPrice: string | null;
  currency: string | null; lineItems: any; invoiceUrl: string | null;
  createdAt: string | null; customerName: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: '#fef3c7', fg: '#92400e' },
  invoice_sent: { bg: '#dbeafe', fg: '#1e40af' },
  completed: { bg: '#95FFB9', fg: '#065f46' },
};

export default function DraftOrdersPage() {
  const [drafts, setDrafts] = useState<DraftOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const limit = 50;

  useEffect(() => { const t = setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 300); return () => clearTimeout(t); }, [query]);

  const fetchDrafts = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (status) params.set('status', status);
    params.set('limit', String(limit));
    params.set('offset', String((page - 1) * limit));
    try {
      const res = await fetch(`/api/crm/draft-orders?${params}`, { credentials: 'include', signal: controller.signal });
      const d = await res.json();
      setDrafts(d.data?.draftOrders ?? []);
      setTotal(d.data?.total ?? 0);
    } catch (e: any) { if (e.name !== 'AbortError') console.error(e); }
    setLoading(false);
  }, [debouncedQuery, status, page]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const pages = Math.ceil(total / limit);

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--crm-space-5)' }}>
        <div className="flex items-center gap-3">
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Draft Orders</h1>
          <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{loading ? '…' : total.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-4)' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, email…" className="crm-input" style={{ flex: 1 }} />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="crm-input" style={{ width: 160 }}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="invoice_sent">Invoice Sent</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="crm-card" style={{ overflow: 'hidden' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Draft</th>
              <th>Customer</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Items</th>
              <th>Date</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {loading && !drafts.length ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div style={{ height: 14, width: '60%', background: 'var(--crm-surface-hover)', borderRadius: 4 }} /></td>)}</tr>
            )) : drafts.map(d => {
              const items = (d.lineItems ?? []) as Array<{ name?: string; title?: string; quantity?: number; price?: string }>;
              const isExpanded = expanded === d.shopifyDraftOrderId;
              const sc = STATUS_COLORS[d.status ?? ''] ?? { bg: '#f3f4f6', fg: '#6b7280' };
              return (
                <React.Fragment key={d.shopifyDraftOrderId}>
                <tr onClick={() => setExpanded(isExpanded ? null : d.shopifyDraftOrderId)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 500 }}>{d.name || d.shopifyDraftOrderId.slice(-8)}</td>
                  <td>
                    {d.shopifyCustomerId ? (
                      <Link href={`/crm/clients/${d.shopifyCustomerId}`} style={{ color: 'var(--crm-text-primary)' }} onClick={e => e.stopPropagation()}>
                        {d.customerName || d.email || d.shopifyCustomerId.slice(0, 10)}
                      </Link>
                    ) : <span style={{ color: 'var(--crm-text-tertiary)' }}>{d.email || 'Guest'}</span>}
                  </td>
                  <td><span className="crm-badge" style={{ background: sc.bg, color: sc.fg, fontSize: 10 }}>{d.status ?? 'unknown'}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>${Number(d.totalPrice ?? 0).toFixed(2)}</td>
                  <td style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {items.slice(0, 2).map(i => i.title || i.name).join(', ')}{items.length > 2 ? ` +${items.length - 2}` : ''}
                  </td>
                  <td style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-CA') : '—'}
                  </td>
                  <td>
                    {d.invoiceUrl && d.status === 'open' && (
                      <a href={d.invoiceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-primary)', textDecoration: 'underline' }}>
                        View
                      </a>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={7} style={{ padding: 'var(--crm-space-3) var(--crm-space-4)', background: 'var(--crm-surface-hover)' }}>
                      <div style={{ fontSize: 'var(--crm-text-xs)' }}>
                        <strong>Items:</strong>
                        <table style={{ width: '100%', marginTop: 4 }}>
                          <tbody>
                            {items.map((item, i) => (
                              <tr key={i}>
                                <td style={{ padding: '2px 0' }}>{item.title || item.name}</td>
                                <td style={{ textAlign: 'right', color: 'var(--crm-text-tertiary)' }}>×{item.quantity ?? 1}</td>
                                <td style={{ textAlign: 'right', width: 80 }}>${Number(item.price ?? 0).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            {!loading && !drafts.length && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--crm-space-12)', color: 'var(--crm-text-tertiary)' }}>No draft orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2" style={{ marginTop: 'var(--crm-space-4)' }}>
          {page > 1 && <button onClick={() => setPage(p => p - 1)} className="crm-btn crm-btn-secondary">← Prev</button>}
          <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)' }}>Page {page} of {pages}</span>
          {page < pages && <button onClick={() => setPage(p => p + 1)} className="crm-btn crm-btn-secondary">Next →</button>}
        </div>
      )}
    </div>
  );
}
