'use client';

import { useState, useEffect, useMemo } from 'react';
import { StatusBadge } from '@/components/crm/StatusBadge';

export interface PickerProduct {
  id: string;
  title: string;
  handle: string;
  status: string | null;
  vendor: string | null;
  productType: string | null;
  imageUrl: string | null;
  priceMin: string | null;
  variants?: Array<{ id: string; title: string | null }>;
}

interface Props {
  /** Products to exclude from the list (already selected) */
  excludeIds?: Set<string>;
  /** Allow selecting multiple products */
  multi?: boolean;
  /** Show variant sub-picker */
  showVariants?: boolean;
  /** Callback when product(s) selected */
  onSelect: (productId: string, variantId?: string) => void;
  /** Callback for multi-select (all selected at once) */
  onSelectMulti?: (productIds: string[]) => void;
  /** Optional hint text for search */
  hint?: string;
  /** Max height of the picker */
  maxHeight?: number;
}

export function InlineProductPicker({ excludeIds, multi, showVariants, onSelect, onSelectMulti, hint, maxHeight = 320 }: Props) {
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(hint ?? '');
  const [vendorFilter, setVendorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch('/api/crm/products?limit=500&status=active,draft', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setProducts((d.data ?? []).map((p: any) => ({
          id: p.shopifyProductId,
          title: p.title ?? '',
          handle: p.handle ?? '',
          status: p.status ?? null,
          vendor: p.vendor ?? null,
          productType: p.productType ?? null,
          imageUrl: Array.isArray(p.images) ? (typeof p.images[0] === 'string' ? p.images[0] : p.images[0]?.src) ?? null : null,
          priceMin: p.priceMin ?? null,
          variants: p.variants?.map((v: any) => ({ id: v.shopifyVariantId ?? v.id, title: v.title })) ?? [],
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const vendors = useMemo(() => Array.from(new Set(products.map(p => p.vendor).filter(Boolean))).sort() as string[], [products]);
  const types = useMemo(() => Array.from(new Set(products.map(p => p.productType).filter(Boolean))).sort() as string[], [products]);

  const filtered = useMemo(() => {
    let f = products;
    if (excludeIds?.size) f = f.filter(p => !excludeIds.has(p.id));
    if (query) { const q = query.toLowerCase(); f = f.filter(p => p.title.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q) || p.vendor?.toLowerCase().includes(q)); }
    if (vendorFilter) f = f.filter(p => p.vendor === vendorFilter);
    if (typeFilter) f = f.filter(p => p.productType === typeFilter);
    return f;
  }, [products, excludeIds, query, vendorFilter, typeFilter]);

  const statusBadge = (s: string | null) => s ? <StatusBadge status={s} /> : null;

  if (loading) return <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>Loading products…</div>;

  return (
    <div>
      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <input className="crm-input" style={{ flex: '1 1 160px', fontSize: 12 }} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products…" autoFocus />
        {vendors.length > 1 && (
          <select className="crm-input" style={{ fontSize: 11 }} value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}>
            <option value="">All brands</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
        {types.length > 1 && (
          <select className="crm-input" style={{ fontSize: 11 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <span style={{ fontSize: 10, color: '#9ca3af', alignSelf: 'center' }}>{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Multi-select actions */}
      {multi && selected.size > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <button onClick={() => { if (onSelectMulti) onSelectMulti(Array.from(selected)); else Array.from(selected).forEach(id => onSelect(id)); setSelected(new Set()); }} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: '#111', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Add {selected.size} selected
          </button>
          <button onClick={() => setSelected(new Set())} style={{ fontSize: 11, padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>Clear</button>
          <button onClick={() => setSelected(new Set(filtered.slice(0, 100).map(p => p.id)))} style={{ fontSize: 11, padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>Select all ({Math.min(filtered.length, 100)})</button>
        </div>
      )}
      {multi && selected.size === 0 && filtered.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <button onClick={() => setSelected(new Set(filtered.slice(0, 100).map(p => p.id)))} style={{ fontSize: 11, padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>Select all ({Math.min(filtered.length, 100)})</button>
        </div>
      )}

      {/* Product table */}
      <div style={{ maxHeight, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 44 }}></th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Product</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 80 }}>Status</th>
              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 60 }}>Price</th>
              <th style={{ padding: '6px 10px', width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                <td style={{ padding: '6px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {multi && <input type="checkbox" checked={selected.has(p.id)} onChange={() => setSelected(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} />}
                    {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: '#f5f5f5' }} />}
                  </div>
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <div style={{ fontWeight: 500 }}>{p.title}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{[p.vendor, p.productType].filter(Boolean).join(' · ')}</div>
                </td>
                <td style={{ padding: '6px 10px' }}>{statusBadge(p.status)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: '#6b7280' }}>{p.priceMin ? `$${p.priceMin}` : '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                    <button onClick={() => onSelect(p.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#374151' }}>Select</button>
                    {showVariants && p.variants && p.variants.length > 1 && (
                      <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#9ca3af' }}>
                        {expandedId === p.id ? '▲' : `${p.variants.length}v`}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>No products match</td></tr>
            )}
          </tbody>
        </table>

        {/* Variant sub-picker */}
        {expandedId && (() => {
          const p = products.find(x => x.id === expandedId);
          if (!p?.variants?.length) return null;
          return (
            <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Select variant for {p.title}:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {p.variants.map(v => (
                  <button key={v.id} onClick={() => { onSelect(p.id, v.id); setExpandedId(null); }} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                    {v.title ?? 'Default'}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
