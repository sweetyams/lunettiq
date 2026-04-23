'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/crm/StatusBadge';

interface Product {
  shopifyProductId: string; title: string | null; vendor: string | null;
  productType: string | null; status: string | null; priceMin: string | null; priceMax: string | null;
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
  const [categoryFilter, setCategoryFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [rxFilter, setRxFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'shopify' | 'square'>('shopify');
  const [syncFilter, setSyncFilter] = useState(false);
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
    if (categoryFilter) params.set('category', categoryFilter);
    if (vendorFilter) params.set('vendor', vendorFilter);
    if (materialFilter) params.set('material', materialFilter);
    if (rxFilter) params.set('rx', rxFilter);
    if (tagFilter) params.set('tag', tagFilter);
    params.set('limit', '250');
    params.set('status', 'active,draft');

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
  }, [typeFilter, categoryFilter, vendorFilter, materialFilter, rxFilter, tagFilter, types.length]);

  // Fetch on debounced query or filter change
  useEffect(() => {
    fetchProducts(debouncedQuery);
  }, [debouncedQuery, fetchProducts]);

  const filtered = products.filter(p => {
    if (stockFilter === 'in' && (p.totalInventory ?? 0) <= 0) return false;
    if (stockFilter === 'out' && (p.totalInventory ?? 0) > 0) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (sourceFilter === 'square' && !p.shopifyProductId.startsWith('sq__')) return false;
    if (sourceFilter === 'shopify' && p.shopifyProductId.startsWith('sq__')) return false;
    if (syncFilter) {
      const c = (p.metafields as any)?.custom ?? {};
      if (c.product_name && c.product_type && c.primary_frame_colour) return false;
    }
    return true;
  });

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--crm-space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-3)' }}>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Products</h1>
          <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>
            {loading ? '…' : filtered.length}
          </span>
        </div>
        <Link href="/crm/settings/product-mapping" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>Square Mapping ↗</Link>
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Category */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--crm-surface-hover)', borderRadius: 20, padding: 2 }}>
            {([['all', 'All'], ['optical', 'Optical'], ['sun', 'Sun']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setCategoryFilter(v === 'all' ? '' : v === categoryFilter ? '' : v)} style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 500, borderRadius: 18, border: 'none', cursor: 'pointer',
                background: (v === 'all' && !categoryFilter) || categoryFilter === v ? 'var(--crm-text-primary)' : 'transparent',
                color: (v === 'all' && !categoryFilter) || categoryFilter === v ? '#fff' : 'var(--crm-text-tertiary)',
              }}>{l}</button>
            ))}
          </div>
          {/* Status */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--crm-surface-hover)', borderRadius: 20, padding: 2 }}>
            {([['all', 'All'], ['active', 'Active'], ['draft', 'Draft']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)} style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 500, borderRadius: 18, border: 'none', cursor: 'pointer',
                background: statusFilter === v ? 'var(--crm-text-primary)' : 'transparent',
                color: statusFilter === v ? '#fff' : 'var(--crm-text-tertiary)',
              }}>{l}</button>
            ))}
          </div>
          {/* Stock */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--crm-surface-hover)', borderRadius: 20, padding: 2 }}>
            {([['all', 'All'], ['in', 'In Stock'], ['out', 'Out']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setStockFilter(v)} style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 500, borderRadius: 18, border: 'none', cursor: 'pointer',
                background: stockFilter === v ? 'var(--crm-text-primary)' : 'transparent',
                color: stockFilter === v ? '#fff' : 'var(--crm-text-tertiary)',
              }}>{l}</button>
            ))}
          </div>
          {/* Source */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--crm-surface-hover)', borderRadius: 20, padding: 2 }}>
            {([['shopify', 'Shopify'], ['square', 'Square'], ['all', 'All']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setSourceFilter(v)} style={{
                padding: '4px 10px', fontSize: 10, fontWeight: 500, borderRadius: 18, border: 'none', cursor: 'pointer',
                background: sourceFilter === v ? 'var(--crm-text-primary)' : 'transparent',
                color: sourceFilter === v ? '#fff' : 'var(--crm-text-tertiary)',
              }}>{l}</button>
            ))}
          </div>
          {/* Needs Sync */}
          <button onClick={() => setSyncFilter(!syncFilter)} style={{
            padding: '4px 10px', fontSize: 10, fontWeight: 500, borderRadius: 18, cursor: 'pointer',
            border: syncFilter ? '1.5px solid #92400e' : '1px solid var(--crm-border)',
            background: syncFilter ? '#fef3c7' : 'transparent',
            color: syncFilter ? '#92400e' : 'var(--crm-text-tertiary)',
          }}>⚠ Needs Sync</button>
        </div>
      </div>

      {loading ? <SkeletonGrid /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-4)' }}>
          {filtered.map(p => {
            const images = (p.images ?? []) as Array<{ src?: string } | string>;
            const imgSrc = typeof images[0] === 'string' ? images[0] : images[0]?.src;
            const inv = p.totalInventory ?? 0;
            const custom = (p.metafields as any)?.custom ?? {};
            const missingKeys = ['product_name', 'product_type', 'primary_frame_colour'].filter(k => !custom[k]);
            const needsSync = missingKeys.length > 0;
            const isSquare = p.shopifyProductId.startsWith('sq__');

            return (
              <Link key={p.shopifyProductId} href={`/crm/products/${p.shopifyProductId}`}
                className="crm-card" style={{ overflow: 'hidden', textDecoration: 'none', color: 'inherit', opacity: searching ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <div style={{ aspectRatio: '1', background: isSquare ? '#e5e7eb' : 'var(--crm-bg)', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSquare ? (
                    <span style={{ fontSize: 32, color: '#9ca3af' }}>■</span>
                  ) : imgSrc ? (
                    <img src={imgSrc} alt={p.title ?? ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                  <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, background: inv > 5 ? '#22c55e' : inv > 0 ? '#eab308' : '#ef4444', border: '1.5px solid #fff' }} title={`${inv} in stock`} />
                  {p.status && <StatusBadge status={p.status} style={{ position: 'absolute', top: 6, left: 6, borderRadius: 4 }} />}
                  {needsSync && <span style={{ position: 'absolute', top: p.status ? 26 : 6, left: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600, border: '1px solid #fde68a' }} title={`Missing: ${missingKeys.join(', ')}`}>!</span>}
                </div>
                <div style={{ padding: 'var(--crm-space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      <Highlight text={p.title ?? ''} query={debouncedQuery} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: inv > 5 ? '#065f46' : inv > 0 ? '#92400e' : '#dc2626', flexShrink: 0 }}>{inv}</span>
                  </div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(p.metafields?.custom?.product_type ?? p.metafields?.custom?.product_category) === 'sun'
                      ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>SUN</span>
                      : (p.metafields?.custom?.product_type ?? p.metafields?.custom?.product_category) === 'optical'
                        ? <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#dbeafe', color: '#1e40af' }}>OPTICAL</span>
                        : null}
                    {isSquare && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>SQUARE</span>}
                  </div>
                  <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: '#f3f4f6', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (inv / 20) * 100)}%`, background: inv > 5 ? '#22c55e' : inv > 0 ? '#eab308' : '#ef4444' }} />
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
