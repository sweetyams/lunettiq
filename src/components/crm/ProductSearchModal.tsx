'use client';

import { useState, useEffect } from 'react';

interface Product { shopifyProductId: string; title: string; vendor: string | null; productType: string | null; priceMin: string | null; imageUrl: string | null; tags: string[] | null; status: string | null; variants?: Array<{ title: string | null; inventoryQuantity: number | null }> }

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (product: { id: string; title: string; variantTitle?: string }) => void;
  skipVariantSelection?: boolean;
}

export function ProductSearchModal({ open, onClose, onSelect, skipVariantSelection }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [vendor, setVendor] = useState('');
  const [productType, setProductType] = useState('');
  const [priceMax, setPriceMax] = useState('');

  // Load all products once on open
  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setAllProducts([]); setSelected(null); setVendor(''); setProductType(''); setPriceMax(''); return; }
    setLoading(true);
    fetch('/api/crm/products?limit=200&status=active,draft', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setAllProducts(d.data ?? []); setResults(d.data ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  // Client-side filter
  useEffect(() => {
    let f = allProducts;
    if (query) { const q = query.toLowerCase(); f = f.filter(p => p.title?.toLowerCase().includes(q) || p.vendor?.toLowerCase().includes(q)); }
    if (vendor) f = f.filter(p => p.vendor === vendor);
    if (productType) f = f.filter(p => p.productType === productType);
    if (priceMax) f = f.filter(p => Number(p.priceMin ?? 0) <= Number(priceMax));
    setResults(f);
  }, [query, vendor, productType, priceMax, allProducts]);

  if (!open) return null;

  const vendors = Array.from(new Set(allProducts.map(p => p.vendor).filter(Boolean))).sort() as string[];
  const types = Array.from(new Set(allProducts.map(p => p.productType).filter(Boolean))).sort() as string[];
  const hasFilters = !!(vendor || productType || priceMax);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
      <div style={{ position: 'fixed', inset: 24, background: 'var(--crm-surface)', borderRadius: 'var(--crm-radius-xl)', boxShadow: 'var(--crm-shadow-overlay)', overflow: 'hidden', zIndex: 50, display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <>
            <div style={{ padding: 'var(--crm-space-4)', borderBottom: '1px solid var(--crm-border)', display: 'flex', gap: 'var(--crm-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={query} onChange={e => setQuery(e.target.value)} autoFocus placeholder="Search products…" className="crm-input" style={{ flex: '1 1 200px', minWidth: 200 }} />
              {vendors.length > 1 && (
                <select value={vendor} onChange={e => setVendor(e.target.value)} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)' }}>
                  <option value="">All brands ({vendors.length})</option>
                  {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
              {types.length > 1 && (
                <select value={productType} onChange={e => setProductType(e.target.value)} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)' }}>
                  <option value="">All types ({types.length})</option>
                  {types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              <select value={priceMax} onChange={e => setPriceMax(e.target.value)} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)' }}>
                <option value="">Any price</option>
                <option value="200">Under $200</option>
                <option value="350">Under $350</option>
                <option value="500">Under $500</option>
                <option value="1000">Under $1,000</option>
              </select>
              {hasFilters && <button onClick={() => { setVendor(''); setProductType(''); setPriceMax(''); }} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--crm-space-4)' }}>
              {loading ? (
                <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>Loading products…</div>
              ) : results.length === 0 ? (
                <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No products found</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--crm-space-3)' }}>
                  {results.map(p => (
                    <button key={p.shopifyProductId} onClick={() => !skipVariantSelection && p.variants && p.variants.length > 1 ? setSelected(p) : onSelect({ id: p.shopifyProductId, title: p.title ?? '' })}
                      style={{ display: 'flex', flexDirection: 'column', background: 'var(--crm-surface)', border: '1px solid var(--crm-border-light)', borderRadius: 'var(--crm-radius-md)', overflow: 'hidden', cursor: 'pointer', fontFamily: 'var(--crm-font)', textAlign: 'left', padding: 0 }}>
                      <div style={{ width: '100%', aspectRatio: '1', background: 'var(--crm-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>No image</span>}
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                        <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
                          {p.status && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: p.status === 'active' ? '#95FFB9' : p.status === 'draft' ? '#CFEDFF' : '#f3f4f6', color: p.status === 'active' ? '#065f46' : p.status === 'draft' ? '#1e40af' : '#6b7280', fontWeight: 600, marginRight: 4 }}>{p.status}</span>}
                          {p.vendor}{p.priceMin ? ` · $${p.priceMin}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: 'var(--crm-space-4)', borderBottom: '1px solid var(--crm-border)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)' }}>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>← Back</button>
              <div><div style={{ fontWeight: 500 }}>{selected.title}</div><div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Pick a variant</div></div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(selected.variants ?? []).map((v, i) => (
                <button key={i} onClick={() => onSelect({ id: selected.shopifyProductId, title: `${selected.title} — ${v.title}`, variantTitle: v.title ?? undefined })}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px var(--crm-space-4)', background: 'none', border: 'none', borderBottom: '1px solid var(--crm-border-light)', cursor: 'pointer', fontFamily: 'var(--crm-font)', fontSize: 'var(--crm-text-sm)' }}>
                  <span style={{ fontWeight: 500 }}>{v.title ?? 'Default'}</span>
                  <span style={{ fontSize: 'var(--crm-text-xs)', color: (v.inventoryQuantity ?? 0) > 0 ? 'var(--crm-success)' : 'var(--crm-text-tertiary)' }}>
                    {(v.inventoryQuantity ?? 0) > 0 ? `${v.inventoryQuantity} in stock` : 'Out of stock'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <div style={{ padding: 'var(--crm-space-3)', borderTop: '1px solid var(--crm-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{results.length} product{results.length !== 1 ? 's' : ''}</span>
          <button onClick={onClose} className="crm-btn crm-btn-secondary">Close</button>
        </div>
      </div>
    </>
  );
}
