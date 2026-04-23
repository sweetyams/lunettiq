'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Family {
  id: string; name: string;
  product_count: string; colour_count: string;
  optical_count: string; sun_count: string; square_count: string;
  products: Array<{ id: string; image: string | null; title: string; category: string | null; colour: string | null; type: string | null; product_status: string | null; square_links: string }> | null;
}

export function FamiliesView({ activeView, onSwitchView }: { activeView?: string; onSwitchView?: (v: 'products' | 'families') => void } = {}) {
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

  const [linkFilter, setLinkFilter] = useState<'all' | 'shopify' | 'square'>('shopify');

  const filtered = families
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))
    .filter(f => {
      if (linkFilter === 'all') return true;
      const hasShopify = (f.products ?? []).some(p => !p.id.startsWith('sq__'));
      return linkFilter === 'shopify' ? hasShopify : !hasShopify;
    });

  function toggle(f: Family) {
    setExpanded(prev => { const next = new Set(prev); if (next.has(f.id)) next.delete(f.id); else next.add(f.id); return next; });
    if (!expanded.has(f.id) && !familySales[f.id]) {
      fetch(`/api/crm/products/families/${f.id}/sales`, { credentials: 'include' })
        .then(r => r.json()).then(d => setFamilySales(prev => ({ ...prev, [f.id]: d.data }))).catch(() => {});
    }
  }

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--crm-space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-3)' }}>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Families</h1>
          <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>{loading ? '…' : filtered.length}</span>
        </div>
        <Link href="/crm/settings/families" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>Manage Families ↗</Link>
      </div>

      <div style={{ marginBottom: 'var(--crm-space-4)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search families…" className="crm-input" style={{ width: 260 }} />
        {(['all', 'shopify', 'square'] as const).map(key => (
          <button key={key} onClick={() => setLinkFilter(key)} style={{
            fontSize: 'var(--crm-text-xs)', padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: 'none',
            background: linkFilter === key ? (key === 'square' ? '#fef3c7' : key === 'shopify' ? '#dbeafe' : 'var(--crm-text-primary)') : 'var(--crm-surface-hover)',
            color: linkFilter === key ? (key === 'square' ? '#92400e' : key === 'shopify' ? '#1e40af' : '#fff') : 'var(--crm-text-tertiary)',
          }}>{key === 'all' ? 'All' : key === 'shopify' ? 'Shopify' : 'Square'}</button>
        ))}
      </div>

      {loading ? <div style={{ color: 'var(--crm-text-tertiary)' }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
          {filtered.map(f => {
            const prods = (f.products ?? []).filter(p => p.id);
            const seen = new Set<string>();
            const uniqueProds = prods.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
            const isExpanded = expanded.has(f.id);
            const sales = familySales[f.id];

            return (
              <div key={f.id} className="crm-card" style={{ overflow: 'hidden' }}>
                {/* Header */}
                <div onClick={() => toggle(f)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', padding: 'var(--crm-space-4)', cursor: 'pointer' }}>
                  <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', width: 12 }}>{isExpanded ? '▼' : '▶'}</span>
                  <Link href={`/crm/products/families/${f.id}`} onClick={e => e.stopPropagation()} style={{ fontWeight: 600, fontSize: 'var(--crm-text-base)', color: 'var(--crm-text-primary)', textDecoration: 'none' }}>
                    {f.name}
                  </Link>
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{f.colour_count} colours</span>
                    {Number(f.optical_count) > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#dbeafe', color: '#1e40af' }}>{f.optical_count} opt</span>}
                    {Number(f.sun_count) > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#fef3c7', color: '#92400e' }}>{f.sun_count} sun</span>}
                    {Number(f.square_count) > 0 ? (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#f5f5f5', color: 'var(--crm-text-secondary)' }}>{f.square_count} ■</span>
                    ) : (
                      <span style={{ fontSize: 10, color: 'var(--crm-warning)' }}>no Square</span>
                    )}
                  </div>
                </div>

                {/* Product thumbnails — always visible */}
                <div style={{ display: 'flex', gap: 6, padding: '0 var(--crm-space-4) var(--crm-space-3)', flexWrap: 'wrap' }}>
                  {uniqueProds.slice(0, 12).map(p => (
                    <Link key={p.id} href={`/crm/products/${p.id}`} title={`${p.title}\n${p.colour ?? ''} · ${p.type ?? ''}`} style={{ position: 'relative' }}>
                      {p.image ? (
                        <img src={p.image} alt={p.title} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, background: '#f5f5f5', transition: 'transform 150ms var(--ease-out)' }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--crm-text-tertiary)' }}>
                          {p.category === 'sun' ? '☀' : '◎'}
                        </div>
                      )}
                    </Link>
                  ))}
                  {uniqueProds.length > 12 && (
                    <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--crm-text-tertiary)' }}>
                      +{uniqueProds.length - 12}
                    </div>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--crm-border-light)' }}>
                    {/* Sales totals */}
                    {sales?.totals && (
                      <div style={{ display: 'flex', gap: 16, padding: 'var(--crm-space-3) var(--crm-space-4)', fontSize: 'var(--crm-text-xs)', background: 'var(--crm-surface-hover)' }}>
                        <span><strong>{sales.totals.units}</strong> units</span>
                        <span><strong>{sales.totals.orders}</strong> orders</span>
                        <span><strong>{fmt(Number(sales.totals.revenue))}</strong> revenue</span>
                        {sales.byChannel?.map((c: any) => (
                          <span key={c.source} style={{ color: 'var(--crm-text-tertiary)' }}>{c.source === 'shopify' ? 'Online' : c.source === 'square' ? 'In-store' : c.source}: {c.units}</span>
                        ))}
                      </div>
                    )}

                    {/* Per-product list */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(() => {
                        const memberMap = new Map((sales?.members ?? []).map((m: any) => [m.productId ?? m.product_id, m.sales]));
                        return uniqueProds.map(p => {
                        const ps = memberMap.get(p.id) as { units: number; orders: number; revenue: number } | undefined;
                        const isPlaceholder = p.id.startsWith('sq__');
                        const Wrapper = isPlaceholder ? 'div' as const : Link;
                        const wrapperProps = isPlaceholder ? {} : { href: `/crm/products/${p.id}` };
                        return (
                          <Wrapper key={p.id} {...wrapperProps as any} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', padding: '8px var(--crm-space-4)', borderBottom: '1px solid var(--crm-border-light)', textDecoration: 'none', color: 'inherit', transition: 'background 100ms' }} className="crm-hover-surface">
                            {isPlaceholder ? (
                              <div style={{ width: 32, height: 32, borderRadius: 4, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>■</div>
                            ) : p.image ? (
                              <img src={p.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} />
                            ) : null}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.colour ?? p.title}
                                {isPlaceholder && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', marginLeft: 4 }}>SQ</span>}
                                {p.product_status && <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: p.product_status === 'active' ? '#95FFB9' : p.product_status === 'draft' ? '#CFEDFF' : '#f3f4f6', color: p.product_status === 'active' ? '#065f46' : p.product_status === 'draft' ? '#1e40af' : '#6b7280', fontWeight: 600 }}>{p.product_status}</span>}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>{p.type ?? ''}</div>
                            </div>
                            {p.category && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: p.category === 'sun' ? '#fef3c7' : '#dbeafe', color: p.category === 'sun' ? '#92400e' : '#1e40af' }}>{p.category === 'sun' ? 'SUN' : 'OPT'}</span>}
                            {ps && ps.units > 0 ? (
                              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-secondary)', whiteSpace: 'nowrap' }}>{ps.units} sold · {fmt(ps.revenue)}</span>
                            ) : (
                              <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>—</span>
                            )}
                            {Number(p.square_links) > 0
                              ? <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>■</span>
                              : <span style={{ fontSize: 10, color: 'var(--crm-warning)' }}>!■</span>}
                          </Wrapper>
                        );
                      });
                      })()}
                    </div>

                    {/* Square-only items */}
                    {(sales?.familyOnlySquare ?? []).length > 0 && (
                      <div style={{ padding: 'var(--crm-space-3) var(--crm-space-4)', borderTop: '1px solid var(--crm-border-light)', background: 'var(--crm-surface-hover)' }}>
                        <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', fontWeight: 500, marginBottom: 4 }}>Square-only (no Shopify product)</div>
                        {(sales?.familyOnlySquare ?? []).map((sq: any, i: number) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 'var(--crm-text-xs)' }}>
                            <span style={{ color: 'var(--crm-text-secondary)' }}>{sq.square_name}</span>
                            {sq.units > 0 ? <span style={{ color: '#F59E0B' }}>{sq.units} sold · {fmt(sq.revenue)}</span> : <span style={{ color: 'var(--crm-text-tertiary)' }}>—</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>No families found</div>}
        </div>
      )}
    </div>
  );
}
