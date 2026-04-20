'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Product {
  shopifyProductId: string; title: string | null; vendor: string | null;
  productType: string | null; priceMin: string | null; priceMax: string | null;
  images: unknown; tags: string[] | null; totalInventory?: number; metafields?: any;
  variants?: Array<{ title: string | null; inventoryQuantity: number | null }>;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return <>{text.slice(0, idx)}<mark style={{ background: 'var(--crm-warning, #fef08a)', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + query.length)}</mark>{text.slice(idx + query.length)}</>;
}

function SkeletonGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-4)' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="crm-card" style={{ overflow: 'hidden' }}>
          <div style={{ aspectRatio: '1', background: 'var(--crm-surface-hover)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ padding: 'var(--crm-space-3)' }}>
            <div style={{ height: 14, width: '70%', background: 'var(--crm-surface-hover)', borderRadius: 4, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ height: 12, width: '40%', background: 'var(--crm-surface-hover)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [rxFilter, setRxFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [types, setTypes] = useState<string[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce search input — 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchProducts = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearching(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (typeFilter) params.set('type', typeFilter);
    if (vendorFilter) params.set('vendor', vendorFilter);
    if (materialFilter) params.set('material', materialFilter);
    if (rxFilter) params.set('rx', rxFilter);
    if (tagFilter) params.set('tag', tagFilter);
    params.set('limit', '250');

    try {
      const res = await fetch(`/api/crm/products?${params}`, { credentials: 'include', signal: controller.signal });
      if (!res.ok) return;
      const d = await res.json();
      const items = d.data ?? d.products ?? [];
      setProducts(items);

      // Extract filter options from first load
      if (!types.length) {
        setTypes(Array.from(new Set(items.map((p: Product) => p.productType).filter(Boolean))) as string[]);
        setVendors(Array.from(new Set(items.map((p: Product) => p.vendor).filter(Boolean))) as string[]);
        const mats = new Set<string>();
        const tags = new Set<string>();
        for (const p of items) {
          const m = p.metafields?.custom;
          if (m?.material) mats.add(m.material);
          if (m?.acetate_source) mats.add(m.acetate_source);
          for (const t of p.tags ?? []) tags.add(t);
        }
        setMaterials(Array.from(mats));
        setAllTags(Array.from(tags).sort());
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error(e);
    } finally {
      setSearching(false);
      setLoading(false);
    }
  }, [typeFilter, vendorFilter, materialFilter, rxFilter, tagFilter, types.length]);

  // Fetch on debounced query or filter change
  useEffect(() => {
    fetchProducts(debouncedQuery);
  }, [debouncedQuery, fetchProducts]);

  const filtered = products.filter(p => {
    if (stockFilter === 'in' && (p.totalInventory ?? 0) <= 0) return false;
    if (stockFilter === 'out' && (p.totalInventory ?? 0) > 0) return false;
    return true;
  });

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Products</h1>
        <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>
          {loading ? '…' : filtered.length}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-5)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, brand, or tag…"
            className="crm-input"
            style={{ width: '100%', paddingRight: 32 }}
          />
          {searching && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--crm-border)', borderTopColor: 'var(--crm-text-primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          )}
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="crm-input">
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} className="crm-input">
          <option value="">All vendors</option>
          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="crm-input">
          <option value="">All materials</option>
          {materials.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={rxFilter} onChange={e => setRxFilter(e.target.value)} className="crm-input">
          <option value="">Rx: Any</option>
          <option value="true">Rx compatible</option>
          <option value="false">Non-Rx</option>
        </select>
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="crm-input">
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['all', 'in', 'out'] as const).map(s => (
            <button key={s} onClick={() => setStockFilter(s)} className="crm-btn" style={{
              fontSize: 'var(--crm-text-xs)', padding: '4px 10px', border: 'none',
              background: stockFilter === s ? 'var(--crm-text-primary)' : 'var(--crm-surface-hover)',
              color: stockFilter === s ? 'var(--crm-text-inverse)' : 'var(--crm-text-secondary)',
              borderRadius: 'var(--crm-radius-sm)', cursor: 'pointer',
            }}>
              {{ all: 'All', in: 'In Stock', out: 'Out' }[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? <SkeletonGrid /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-4)' }}>
          {filtered.map(p => {
            const images = (p.images ?? []) as Array<{ src?: string } | string>;
            const imgSrc = typeof images[0] === 'string' ? images[0] : images[0]?.src;
            const inv = p.totalInventory ?? 0;
            const variants = p.variants ?? [];

            return (
              <Link key={p.shopifyProductId} href={`/crm/products/${p.shopifyProductId}`}
                className="crm-card" style={{ overflow: 'hidden', textDecoration: 'none', color: 'inherit', opacity: searching ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <div style={{ aspectRatio: '1', background: 'var(--crm-bg)', overflow: 'hidden' }}>
                  {imgSrc && <img src={imgSrc} alt={p.title ?? ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ padding: 'var(--crm-space-3)' }}>
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Highlight text={p.title ?? ''} query={debouncedQuery} />
                  </div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
                    <Highlight text={p.vendor ?? ''} query={debouncedQuery} />
                  </div>
                  {variants.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 'var(--crm-space-2)' }}>
                      {variants.slice(0, 4).map((v, i) => (
                        <span key={i} className="crm-badge" style={{ fontSize: 10, background: 'var(--crm-surface-hover)', color: 'var(--crm-text-tertiary)' }}>
                          {v.title}
                        </span>
                      ))}
                      {variants.length > 4 && <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>+{variants.length - 4}</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--crm-space-2)' }}>
                    <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>
                      {p.priceMin === p.priceMax ? `$${p.priceMin}` : `$${p.priceMin}–$${p.priceMax}`}
                    </span>
                    <span style={{ fontSize: 'var(--crm-text-xs)', color: inv > 0 ? 'var(--crm-success)' : 'var(--crm-error)' }}>
                      {inv > 0 ? `${inv} in stock` : 'Out'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {!filtered.length && !searching && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--crm-space-12)', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
              No products found
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
