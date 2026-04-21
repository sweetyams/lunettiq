'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Family {
  id: string; name: string;
  product_count: string; colour_count: string;
  optical_count: string; sun_count: string; square_count: string;
  products: Array<{ id: string; image: string | null; title: string; category: string | null; colour: string | null; type: string | null; square_links: string }> | null;
}

export function FamiliesView({ activeView, onSwitchView }: { activeView: string; onSwitchView: (v: 'products' | 'families') => void }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [familySales, setFamilySales] = useState<Record<string, any>>({});

  useEffect(() => {
    fetch('/api/crm/products/families', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setFamilies(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? families.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : families;

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--crm-space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-3)' }}>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Catalogue</h1>
          <div style={{ display: 'flex', gap: 0, marginLeft: 8 }}>
            {(['products', 'families'] as const).map(v => (
              <button key={v} onClick={() => onSwitchView(v)} style={{
                padding: '4px 12px', fontSize: 'var(--crm-text-xs)', border: 'none', cursor: 'pointer', background: 'none',
                borderBottom: activeView === v ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
                color: activeView === v ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
                fontWeight: activeView === v ? 500 : 400, textTransform: 'capitalize',
              }}>{v}</button>
            ))}
          </div>
          <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>
            {loading ? '…' : filtered.length}
          </span>
        </div>
        <Link href="/crm/settings/families" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>Manage Families ↗</Link>
      </div>

      <div style={{ marginBottom: 'var(--crm-space-4)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search families…" className="crm-input" style={{ width: 260 }} />
      </div>

      {loading ? <div style={{ color: 'var(--crm-text-tertiary)' }}>Loading…</div> : (
        <div className="crm-card" style={{ overflow: 'hidden' }}>
          <table className="crm-table">
            <thead>
              <tr>
                <th>Family</th>
                <th>Products</th>
                <th style={{ width: 80, textAlign: 'center' }}>Colours</th>
                <th style={{ width: 80, textAlign: 'center' }}>Optical</th>
                <th style={{ width: 80, textAlign: 'center' }}>Sun</th>
                <th style={{ width: 80, textAlign: 'center' }}>Square</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const prods = (f.products ?? []).filter(p => p.id);
                const seen = new Set<string>();
                const uniqueProds = prods.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
                const isExpanded = expanded.has(f.id);
                return (
                  <React.Fragment key={f.id}>
                  <tr onClick={() => {
                    setExpanded(prev => { const next = new Set(prev); if (next.has(f.id)) next.delete(f.id); else next.add(f.id); return next; });
                    if (!expanded.has(f.id) && !familySales[f.id]) {
                      fetch(`/api/crm/products/families/${f.id}/sales`, { credentials: 'include' })
                        .then(r => r.json()).then(d => setFamilySales(prev => ({ ...prev, [f.id]: d.data }))).catch(() => {});
                    }
                  }} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', width: 12 }}>{isExpanded ? '▼' : '▶'}</span>
                        <Link href={`/crm/products/families/${f.id}`} onClick={e => e.stopPropagation()} style={{ fontWeight: 600, color: 'var(--crm-text-primary)', textDecoration: 'none', fontSize: 'var(--crm-text-sm)' }}>
                          {f.name}
                        </Link>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {uniqueProds.slice(0, 8).map(p => (
                          <Link key={p.id} href={`/crm/products/${p.id}`} onClick={e => e.stopPropagation()} title={p.title}>
                            {p.image ? (
                              <img src={p.image} alt={p.title} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: 4, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'var(--crm-text-tertiary)' }}>
                                {p.category === 'sun' ? '☀' : '◎'}
                              </div>
                            )}
                          </Link>
                        ))}
                        {uniqueProds.length > 8 && (
                          <div style={{ width: 40, height: 40, borderRadius: 4, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                            +{uniqueProds.length - 8}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 500 }}>{f.colour_count}</td>
                    <td style={{ textAlign: 'center' }}>
                      {Number(f.optical_count) > 0 && <span style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px', borderRadius: 10, background: '#dbeafe', color: '#1e40af' }}>{f.optical_count}</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {Number(f.sun_count) > 0 && <span style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#92400e' }}>{f.sun_count}</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {Number(f.square_count) > 0 ? (
                        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500 }}>{f.square_count}</span>
                      ) : (
                        <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-warning, #d97706)' }}>—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (() => {
                    const sales = familySales[f.id];
                    const memberMap = new Map((sales?.members ?? []).map((m: any) => [m.product_id, m.sales]));
                    const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
                    return (
                      <>
                        {/* Family totals */}
                        {sales?.totals && (
                          <tr style={{ background: 'var(--crm-surface-hover)' }}>
                            <td colSpan={6} style={{ paddingLeft: 32 }}>
                              <div style={{ display: 'flex', gap: 16, fontSize: 'var(--crm-text-xs)' }}>
                                <span><strong>{sales.totals.units}</strong> units</span>
                                <span><strong>{sales.totals.orders}</strong> orders</span>
                                <span><strong>{fmt(Number(sales.totals.revenue))}</strong> revenue</span>
                                {sales.byChannel?.map((c: any) => (
                                  <span key={c.source} style={{ color: 'var(--crm-text-tertiary)' }}>{c.source === 'shopify' ? 'Online' : c.source === 'square' ? 'In-store' : c.source}: {c.units}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Per product */}
                        {uniqueProds.map(p => {
                          const ps = memberMap.get(p.id) as { units: number; orders: number; revenue: number } | undefined;
                          return (
                          <tr key={`${f.id}-${p.id}`} style={{ background: 'var(--crm-surface-hover)' }}>
                            <td style={{ paddingLeft: 32 }}>
                              <Link href={`/crm/products/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
                                {p.image && <img src={p.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 3, background: '#f5f5f5' }} />}
                                <div>
                                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{p.title}</div>
                                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{p.colour}{p.type ? ` · ${p.type}` : ''}</div>
                                </div>
                              </Link>
                            </td>
                            <td>
                              {ps && ps.units > 0 ? (
                                <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)' }}>{ps.units} sold · {fmt(ps.revenue)}</span>
                              ) : (
                                <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>no sales</span>
                              )}
                            </td>
                            <td>
                              {p.category && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: p.category === 'sun' ? '#fef3c7' : '#dbeafe', color: p.category === 'sun' ? '#92400e' : '#1e40af' }}>{p.category === 'sun' ? 'SUN' : 'OPTICAL'}</span>}
                            </td>
                            <td colSpan={3} style={{ textAlign: 'center' }}>
                              {Number(p.square_links) > 0
                                ? <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500 }}>{p.square_links} Square</span>
                                : <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-warning, #d97706)' }}>no Square link</span>}
                            </td>
                          </tr>
                          );
                        })}
                        {/* Family-only Square items (no Shopify product) */}
                        {sales?.familyOnlySquare?.length > 0 && (
                          <tr style={{ background: 'var(--crm-surface-hover)' }}>
                            <td colSpan={6} style={{ paddingLeft: 32 }}>
                              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', fontWeight: 500, marginBottom: 4, marginTop: 4 }}>Square-only (no Shopify product)</div>
                            </td>
                          </tr>
                        )}
                        {(sales?.familyOnlySquare ?? []).map((sq: any, i: number) => (
                          <tr key={`${f.id}-sq-${i}`} style={{ background: 'var(--crm-surface-hover)' }}>
                            <td style={{ paddingLeft: 40 }}>
                              <div style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-secondary)' }}>{sq.square_name}</div>
                            </td>
                            <td>
                              {sq.units > 0 ? (
                                <span style={{ fontSize: 'var(--crm-text-xs)', color: '#F59E0B' }}>{sq.units} sold · {fmt(sq.revenue)}</span>
                              ) : (
                                <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>no sales</span>
                              )}
                            </td>
                            <td><span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#FEF3C7', color: '#92400E' }}>SQUARE</span></td>
                            <td colSpan={3}></td>
                          </tr>
                        ))}
                      </>
                    );
                  })()}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>No families found</div>}
        </div>
      )}
    </div>
  );
}
