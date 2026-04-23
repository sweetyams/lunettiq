'use client';

import { useEffect, useState } from 'react';
import { InlineProductPicker } from '@/components/crm/InlineProductPicker';

interface Mapping {
  square_catalog_id: string; square_name: string; shopify_product_id: string | null;
  shopify_title: string | null; shopify_handle: string | null; shopify_type: string | null;
  shopify_image: string | null; shopify_status: string | null;
  shopify_image: string | null; family_id: string | null;
  product_category: string | null; family_type: string | null; family_colour: string | null; family_name: string | null;
  confidence: string | null; status: string; parsed_frame: string | null;
  parsed_colour: string | null; parsed_type: string | null;
}
interface ShopifyProduct { id: string; title: string; handle: string; status?: string | null; category?: string | null; variants?: Array<{ id: string; title: string | null }> }

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
  const [choosingFamily, setChoosingFamily] = useState<string | null>(null);
  const [families, setFamilies] = useState<Array<{ id: string; name: string }>>([]);
  const [familyMembers, setFamilyMembers] = useState<Array<{ product_id: string; family_id: string; type: string | null }>>([]);
  const [autoMatchResult, setAutoMatchResult] = useState<any>(null);
  const [autoMatching, setAutoMatching] = useState(false);
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
    fetch('/api/crm/products?limit=500&status=active,draft', { credentials: 'include' })
      .then(r => r.json()).then(d => setProducts((d.data ?? []).map((p: any) => ({ id: p.shopifyProductId, title: p.title, handle: p.handle, status: p.status, category: p.metafields?.custom?.product_type ?? p.metafields?.custom?.product_category ?? null, variants: p.variants?.map((v: any) => ({ id: v.shopifyVariantId ?? v.id, title: v.title })) ?? [] }))))
      .catch(() => {});
    fetch('/api/crm/settings/families', { credentials: 'include' })
      .then(r => r.json()).then(d => { setFamilies(d.data?.families ?? []); setFamilyMembers(d.data?.members ?? []); })
      .catch(() => {});
  }, []);

  function handleSearch() { setPage(0); load(filter, search, 0); }

  // Search as you type with debounce
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); load(filter, search, 0); }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateLocal(squareCatalogId: string, updates: Partial<Mapping>) {
    setMappings(prev => prev.map(m => m.square_catalog_id === squareCatalogId ? { ...m, ...updates } : m));
  }

  async function linkProduct(squareCatalogId: string, shopifyProductId: string, shopifyVariantId?: string) {
    // Auto-resolve family from the chosen product
    const fm = familyMembers.find(m => m.product_id === shopifyProductId);
    const prod = products.find(p => p.id === shopifyProductId);
    updateLocal(squareCatalogId, { shopify_product_id: shopifyProductId, shopify_title: prod?.title ?? shopifyProductId, shopify_status: prod?.status ?? null, status: 'manual' } as any);
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, shopifyProductId, shopifyVariantId: shopifyVariantId ?? null, familyId: fm?.family_id ?? null, status: 'manual' }),
    });
  }

  async function confirm(squareCatalogId: string) {
    updateLocal(squareCatalogId, { status: 'confirmed' } as any);
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, status: 'confirmed' }),
    });
  }

  async function markRelated(squareCatalogId: string) {
    const mapping = mappings.find(m => m.square_catalog_id === squareCatalogId);
    const fm = mapping?.shopify_product_id ? familyMembers.find(m => m.product_id === mapping.shopify_product_id) : null;
    updateLocal(squareCatalogId, { status: 'related' } as any);
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, status: 'related', familyId: fm?.family_id ?? null }),
    });
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
    updateLocal(squareCatalogId, { status: 'ignored', shopify_product_id: null } as any);
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, status: 'ignored', shopifyProductId: null }),
    });
  }

  async function linkFamily(squareCatalogId: string, familyId: string) {
    updateLocal(squareCatalogId, { status: 'related', family_id: familyId } as any);
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, familyId, shopifyProductId: null, shopifyVariantId: null, status: 'related' }),
    });
    setChoosingFamily(null);
  }

  async function unlinkProduct(squareCatalogId: string) {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, shopifyProductId: null, shopifyVariantId: null, status: 'related' }),
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
          <button onClick={async () => {
            setAutoMatching(true); setAutoMatchResult(null);
            const r = await fetch('/api/crm/system/auto-match-square', { method: 'POST', credentials: 'include' });
            const d = await r.json();
            setAutoMatchResult(d.data); setAutoMatching(false); load(filter, search);
          }} disabled={autoMatching} style={{ marginLeft: 8, fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'var(--crm-text-primary)', color: 'white' }}>
            {autoMatching ? 'Matching…' : '⟳ Auto-Match'}
          </button>
        </div>
      </div>

      {/* Auto-match results */}
      {autoMatchResult && (
        <div className="crm-card" style={{ padding: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-4)', borderLeft: '3px solid var(--crm-success, #16a34a)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 'var(--crm-text-sm)' }}>
              Auto-match complete: <strong>{autoMatchResult.auto}</strong> matched · <strong>{autoMatchResult.familyOnly}</strong> family-only · <strong>{autoMatchResult.unmatched}</strong> unmatched · {autoMatchResult.skipped} skipped
              {autoMatchResult.familiesCreated > 0 && <> · <strong style={{ color: 'var(--crm-success)' }}>{autoMatchResult.familiesCreated}</strong> families created · <strong>{autoMatchResult.placeholdersCreated}</strong> placeholders</>}
            </div>
            <button onClick={() => setAutoMatchResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-tertiary)' }}>✕</button>
          </div>
        </div>
      )}

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
                    <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {m.parsed_frame} · {m.parsed_colour}
                      {(m.product_category ?? m.family_type ?? m.parsed_type) && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: (m.product_category ?? m.family_type ?? m.parsed_type)?.includes('sun') ? '#fef3c7' : '#dbeafe', color: (m.product_category ?? m.family_type ?? m.parsed_type)?.includes('sun') ? '#92400e' : '#1e40af' }}>{(m.product_category ?? m.family_type ?? m.parsed_type) === 'sun' ? 'SUN' : 'OPTICAL'}</span>}
                      {m.family_name && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#f3e8ff', color: '#7c3aed' }}>{m.family_name}</span>}
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
                          {m.shopify_status && <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: m.shopify_status === 'active' ? '#95FFB9' : m.shopify_status === 'draft' ? '#CFEDFF' : '#f3f4f6', color: m.shopify_status === 'active' ? '#065f46' : m.shopify_status === 'draft' ? '#1e40af' : '#6b7280', fontWeight: 600 }}>{m.shopify_status}</span>}
                        </div>
                      </div>
                    ) : m.family_id ? (
                      <span style={{ fontSize: 'var(--crm-text-xs)', color: '#8b5cf6' }}>↳ Family: {families.find(f => f.id === m.family_id)?.name ?? m.family_id}</span>
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
                      <button onClick={() => setChoosingFamily(m.square_catalog_id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid #8b5cf6', background: 'none', color: '#8b5cf6', cursor: 'pointer' }}>Family</button>
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
            <InlineProductPicker onSelect={(productId) => { linkProduct(choosing, productId); setChoosing(null); }} hint={mappings.find(m => m.square_catalog_id === choosing)?.parsed_frame ?? ''} maxHeight={400} />
          </div>
        </div>
      )}

      {/* Link to family modal */}
      {choosingFamily && (() => {
        const mapping = mappings.find(m => m.square_catalog_id === choosingFamily);
        const hint = mapping?.parsed_frame ?? mapping?.square_name ?? '';
        return (
        <div className="crm-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setChoosingFamily(null); }}>
          <div className="crm-card crm-modal" style={{ width: 360, padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Link to Family</h2>
              <button onClick={() => setChoosingFamily(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-3)' }}>
              {mapping?.square_name}
            </div>
            <FamilySearch families={families} hint={hint} onSelect={(familyId) => linkFamily(choosingFamily, familyId)} />
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function ProductSearch({ products, familyMembers, families, onSelect, hint }: { products: ShopifyProduct[]; familyMembers?: Array<{ product_id: string; family_id: string; type: string | null }>; families?: Array<{ id: string; name: string }>; onSelect: (productId: string, variantId?: string) => void; hint: string }) {
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
            const fm = familyMembers?.find(m => m.product_id === p.id);
            const famName = fm ? families?.find(f => f.id === fm.family_id)?.name : null;
            const type = p.category ?? fm?.type ?? null;
            return (
            <button key={p.id} onClick={() => { setSelectedProduct(p); setOpen(false); setQuery(p.title); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 'var(--crm-text-xs)', border: 'none', background: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span>{p.title}{p.status && <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: p.status === 'active' ? '#95FFB9' : p.status === 'draft' ? '#CFEDFF' : '#f3f4f6', color: p.status === 'active' ? '#065f46' : p.status === 'draft' ? '#1e40af' : '#6b7280', fontWeight: 600 }}>{p.status}</span>}</span>
              <span style={{ display: 'flex', gap: 3, flexShrink: 0, marginLeft: 6 }}>
                {type && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: type === 'sun' ? '#fef3c7' : '#dbeafe', color: type === 'sun' ? '#92400e' : '#1e40af' }}>{type === 'sun' ? 'SUN' : 'OPTICAL'}</span>}
                {famName && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f3e8ff', color: '#7c3aed' }}>{famName}</span>}
              </span>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FamilySearch({ families, hint, onSelect }: { families: Array<{ id: string; name: string }>; hint: string; onSelect: (familyId: string) => void }) {
  const [query, setQuery] = useState(hint);
  const filtered = query.length >= 1
    ? families.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    : families;

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search families…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 8 }} autoFocus />
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {filtered.map(f => (
          <button key={f.id} onClick={() => onSelect(f.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 'var(--crm-text-sm)', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4, fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >{f.name}</button>
        ))}
        {filtered.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>No families found</div>}
      </div>
    </div>
  );
}
