'use client';

import { useEffect, useState } from 'react';

interface Mapping {
  square_catalog_id: string; square_name: string; shopify_product_id: string | null;
  shopify_title: string | null; shopify_handle: string | null; shopify_type: string | null;
  shopify_image: string | null;
  confidence: string | null; status: string; parsed_frame: string | null;
  parsed_colour: string | null; parsed_type: string | null;
}
interface ShopifyProduct { id: string; title: string; handle: string; variants?: Array<{ id: string; title: string | null }> }

const STATUS_COLOURS: Record<string, string> = {
  auto: '#16a34a', confirmed: '#16a34a', related: '#2563eb', manual: '#8b5cf6', unmatched: '#dc2626', ignored: '#9ca3af',
};
const STATUS_LABELS: Record<string, string> = {
  auto: 'Auto', confirmed: 'Exact', related: 'Related', manual: 'Manual', unmatched: 'Unmatched', ignored: 'Ignored',
};

export default function ProductMappingPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [filter, setFilter] = useState('auto');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  function load(status?: string, q?: string, p?: number) {
    setLoading(true);
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (q) params.set('q', q);
    params.set('offset', String((p ?? page) * PAGE_SIZE));
    params.set('limit', String(PAGE_SIZE));
    fetch(`/api/crm/product-mappings?${params}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setMappings(d.data?.mappings ?? []); setStats(d.data?.stats ?? {}); })
      .catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { setPage(0); load(filter, search, 0); }, [filter]);
  useEffect(() => { load(filter, search, page); }, [page]);
  useEffect(() => {
    fetch('/api/crm/products?limit=500', { credentials: 'include' })
      .then(r => r.json()).then(d => setProducts((d.data ?? []).map((p: any) => ({ id: p.shopifyProductId, title: p.title, handle: p.handle, variants: p.variants?.map((v: any) => ({ id: v.shopifyVariantId ?? v.id, title: v.title })) ?? [] }))))
      .catch(() => {});
  }, []);

  function handleSearch() { setPage(0); load(filter, search, 0); }

  // Search as you type with debounce
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); load(filter, search, 0); }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function linkProduct(squareCatalogId: string, shopifyProductId: string, shopifyVariantId?: string) {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, shopifyProductId, shopifyVariantId: shopifyVariantId ?? null, status: 'manual' }),
    });
    load(filter, search);
  }

  async function confirm(squareCatalogId: string) {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, status: 'confirmed' }),
    });
    load(filter, search);
  }

  async function markRelated(squareCatalogId: string) {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, status: 'related' }),
    });
    load(filter, search);
  }

  async function confirmAll() {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmAllAuto: true }),
    });
    load(filter, search);
  }

  async function ignoreNoMatch() {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ignoreAllNoMatch: true }),
    });
    load(filter, search);
  }

  async function ignore(squareCatalogId: string) {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, status: 'ignored', shopifyProductId: null }),
    });
    load(filter, search);
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-4)' }}>
        <div>
          <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Product Mapping</h1>
          <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
            Link Square catalog items to Shopify products
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
          {total} items · {stats.auto ?? 0} auto · {stats.confirmed ?? 0} confirmed · {stats.manual ?? 0} manual · {stats.unmatched ?? 0} unmatched
          {(stats.auto ?? 0) > 0 && <button onClick={confirmAll} style={{ marginLeft: 12, fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'var(--crm-success, #16a34a)', color: 'white' }}>✓ Confirm All Auto</button>}
          {filter === 'unmatched' && <button onClick={ignoreNoMatch} style={{ marginLeft: 8, fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'var(--crm-border)', color: 'var(--crm-text-secondary)' }}>Ignore All No Match</button>}
        </div>
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-4)' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--crm-border-light)' }}>
          {['auto', 'unmatched', 'confirmed', 'related', 'manual', 'ignored', 'all'].map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '6px 14px', fontSize: 'var(--crm-text-xs)', border: 'none', cursor: 'pointer', background: 'none',
              borderBottom: filter === t ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
              color: filter === t ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
              fontWeight: filter === t ? 500 : 400,
            }}>{STATUS_LABELS[t] ?? 'All'} {stats[t] ? `(${stats[t]})` : ''}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); handleSearch(); }} style={{ display: 'flex', gap: 4 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Square or Shopify name…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: 240 }} />
          <button type="submit" className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>Go</button>
        </form>
      </div>

      {/* Table */}
      {loading ? <div style={{ color: 'var(--crm-text-tertiary)' }}>Loading…</div> : (
        <>
        <div className="crm-card" style={{ overflow: 'hidden' }}>
          <table className="crm-table" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Status</th>
                <th>Square Item</th>
                <th>→ Shopify Product</th>
                <th style={{ width: 60 }}>Score</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map(m => (
                <tr key={m.square_catalog_id}>
                  <td>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: `${STATUS_COLOURS[m.status]}15`, color: STATUS_COLOURS[m.status] }}>
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{m.square_name}</div>
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
                      {m.parsed_frame} · {m.parsed_colour} · {m.parsed_type}
                    </div>
                  </td>
                  <td>
                    {m.shopify_title ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.shopify_image && (
                          <img src={m.shopify_image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, background: 'var(--crm-surface-hover)' }} />
                        )}
                        <div>
                          <span style={{ color: 'var(--crm-text-primary)' }}>{m.shopify_title}</span>
                          {m.shopify_type && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: m.shopify_type.toLowerCase().includes('sun') ? '#fef3c7' : '#dbeafe', color: m.shopify_type.toLowerCase().includes('sun') ? '#92400e' : '#1e40af' }}>{m.shopify_type}</span>}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>No match</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11 }}>
                    {m.confidence ? `${Math.round(Number(m.confidence) * 100)}%` : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {m.shopify_product_id && m.status !== 'confirmed' && m.status !== 'ignored' && m.status !== 'related' && (
                        <button onClick={() => confirm(m.square_catalog_id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--crm-success, #16a34a)', background: 'none', color: 'var(--crm-success, #16a34a)', cursor: 'pointer' }}>Exact</button>
                      )}
                      {m.shopify_product_id && m.status !== 'related' && m.status !== 'confirmed' && m.status !== 'ignored' && (
                        <button onClick={() => markRelated(m.square_catalog_id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid #2563eb', background: 'none', color: '#2563eb', cursor: 'pointer' }}>Related</button>
                      )}
                      {m.status !== 'ignored' && (
                        <button onClick={() => ignore(m.square_catalog_id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', color: 'var(--crm-text-tertiary)', cursor: 'pointer' }}>Ignore</button>
                      )}
                      <button onClick={() => setChoosing(m.square_catalog_id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--crm-text-primary)', background: 'none', color: 'var(--crm-text-primary)', cursor: 'pointer' }}>Choose</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {mappings.length === 0 && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>No items found</div>}
        </div>
        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--crm-space-3)' }}>
          <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + mappings.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 12px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>← Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={mappings.length < PAGE_SIZE}
              style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 12px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: mappings.length < PAGE_SIZE ? 'default' : 'pointer', opacity: mappings.length < PAGE_SIZE ? 0.4 : 1 }}>Next →</button>
          </div>
        </div>
        </>
      )}

      {/* Choose product modal */}
      {choosing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setChoosing(null); }}>
          <div className="crm-card" style={{ width: 480, maxHeight: '70vh', overflow: 'visible', padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-4)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Choose Shopify Product</h2>
              <button onClick={() => setChoosing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-3)' }}>
              Linking: {mappings.find(m => m.square_catalog_id === choosing)?.square_name}
            </div>
            <ProductSearch products={products} onSelect={(productId, variantId) => { linkProduct(choosing, productId, variantId); setChoosing(null); }} hint={mappings.find(m => m.square_catalog_id === choosing)?.parsed_frame ?? ''} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProductSearch({ products, onSelect, hint }: { products: ShopifyProduct[]; onSelect: (productId: string, variantId?: string) => void; hint: string }) {
  const [query, setQuery] = useState(hint);
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);

  const filtered = query.length >= 2
    ? products.filter(p => p.title.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  if (selectedProduct) {
    return (
      <div>
        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, marginBottom: 8 }}>{selectedProduct.title}</div>
        <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 8 }}>Select variant (or link to product only):</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => onSelect(selectedProduct.id)}
            style={{ textAlign: 'left', padding: '8px 12px', fontSize: 'var(--crm-text-xs)', border: '1px solid var(--crm-border)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >Product only (no specific variant)</button>
          {(selectedProduct.variants ?? []).map(v => (
            <button key={v.id} onClick={() => onSelect(selectedProduct.id, v.id)}
              style={{ textAlign: 'left', padding: '8px 12px', fontSize: 'var(--crm-text-xs)', border: '1px solid var(--crm-border)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >{v.title || 'Default'}</button>
          ))}
        </div>
        <button onClick={() => setSelectedProduct(null)} style={{ marginTop: 8, fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>← Back to search</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search Shopify product…"
        className="crm-input"
        style={{ fontSize: 'var(--crm-text-xs)', width: '100%' }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: 'var(--crm-surface)', border: '1px solid var(--crm-border)', borderRadius: 'var(--crm-radius-md)', boxShadow: 'var(--crm-shadow-lg)', maxHeight: 200, overflowY: 'auto' }}>
          {filtered.map(p => {
            const isSun = p.handle.includes('-sun') || p.handle.includes('sunglasses');
            const isOpt = p.handle.includes('-opt') || p.handle.includes('optic');
            return (
            <button key={p.id} onClick={() => { setSelectedProduct(p); setOpen(false); setQuery(p.title); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 'var(--crm-text-xs)', border: 'none', background: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span>{p.title}</span>
              {(isSun || isOpt) && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: isSun ? '#fef3c7' : '#dbeafe', color: isSun ? '#92400e' : '#1e40af', flexShrink: 0, marginLeft: 6 }}>{isSun ? 'SUN' : 'OPTICAL'}</span>}
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
