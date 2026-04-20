'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Order {
  shopifyOrderId: string; shopifyCustomerId: string | null; orderNumber: string | null;
  financialStatus: string | null; fulfillmentStatus: string | null;
  totalPrice: string | null; currency: string | null; source: string | null;
  lineItems: any; createdAt: string | null; customerName: string | null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const limit = 50;

  useEffect(() => { const t = setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 300); return () => clearTimeout(t); }, [query]);

  const fetchOrders = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (source) params.set('source', source);
    params.set('limit', String(limit));
    params.set('offset', String((page - 1) * limit));
    try {
      const res = await fetch(`/api/crm/orders?${params}`, { credentials: 'include', signal: controller.signal });
      const d = await res.json();
      setOrders(d.data?.orders ?? d.orders ?? []);
      setTotal(d.data?.total ?? d.total ?? 0);
    } catch (e: any) { if (e.name !== 'AbortError') console.error(e); }
    setLoading(false);
  }, [debouncedQuery, source, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const pages = Math.ceil(total / limit);

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--crm-space-5)' }}>
        <div className="flex items-center gap-3">
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Orders</h1>
          <span className="crm-badge" style={{ background: 'var(--crm-surface-hover)', color: 'var(--crm-text-secondary)' }}>{loading ? '…' : total.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-4)' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by order #, customer name, email…" className="crm-input" style={{ flex: 1 }} />
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }} className="crm-input" style={{ width: 140 }}>
          <option value="">All sources</option>
          <option value="shopify">Shopify</option>
          <option value="square">Square POS</option>
        </select>
      </div>

      <div className="crm-card" style={{ overflow: 'hidden' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Source</th>
              <th style={{ textAlign: 'right' }}>Total</th>
              <th>Status</th>
              <th>Items</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && !orders.length ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><div style={{ height: 14, width: '60%', background: 'var(--crm-surface-hover)', borderRadius: 4 }} /></td>)}</tr>
            )) : orders.map(o => {
              const items = (o.lineItems ?? []) as Array<{ name?: string; quantity?: number; price?: string }>;
              const isExpanded = expanded === o.shopifyOrderId;
              return (
                <React.Fragment key={o.shopifyOrderId}>
                <tr onClick={() => setExpanded(isExpanded ? null : o.shopifyOrderId)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 500 }}>#{o.orderNumber}</td>
                  <td>
                    {o.shopifyCustomerId ? (
                      <Link href={`/crm/clients/${o.shopifyCustomerId}`} style={{ color: 'var(--crm-text-primary)' }} onClick={e => e.stopPropagation()}>
                        {o.customerName || o.shopifyCustomerId.slice(0, 10)}
                      </Link>
                    ) : <span style={{ color: 'var(--crm-text-tertiary)' }}>Guest</span>}
                  </td>
                  <td><span className="crm-badge" style={{ background: o.source === 'square' ? '#fee2e2' : '#e0f2fe', color: o.source === 'square' ? '#991b1b' : '#0369a1', fontSize: 10 }}>{o.source ?? 'shopify'}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>${Number(o.totalPrice ?? 0).toFixed(2)}</td>
                  <td><span style={{ fontSize: 'var(--crm-text-xs)', color: o.financialStatus === 'paid' ? 'var(--crm-success)' : 'var(--crm-text-tertiary)' }}>{o.financialStatus}</span></td>
                  <td style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {items.slice(0, 2).map(i => i.name).join(', ')}{items.length > 2 ? ` +${items.length - 2}` : ''}
                  </td>
                  <td style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-CA') : '—'}
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
                                <td style={{ padding: '2px 0' }}>{item.name}</td>
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
            {!loading && !orders.length && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--crm-space-12)', color: 'var(--crm-text-tertiary)' }}>No orders found</td></tr>
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
