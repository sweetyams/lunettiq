'use client';

import { useEffect, useState } from 'react';

interface Mapping {
  square_catalog_id: string; square_name: string; shopify_product_id: string | null;
  shopify_title: string | null; shopify_handle: string | null; shopify_type: string | null;
  shopify_image: string | null;
  confidence: string | null; status: string; parsed_frame: string | null;
  parsed_colour: string | null; parsed_type: string | null;
}
interface ShopifyProduct { id: string; title: string; handle: string }

const STATUS_COLOURS: Record<string, string> = {
  auto: '#16a34a', confirmed: '#16a34a', manual: '#2563eb', unmatched: '#dc2626', ignored: '#9ca3af',
};
const STATUS_LABELS: Record<string, string> = {
  auto: 'Auto', confirmed: 'Confirmed', manual: 'Manual', unmatched: 'Unmatched', ignored: 'Ignored',
};

export default function ProductMappingPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [filter, setFilter] = useState('auto');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  function load(status?: string, q?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (q) params.set('q', q);
    fetch(`/api/crm/product-mappings?${params}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setMappings(d.data?.mappings ?? []); setStats(d.data?.stats ?? {}); })
      .catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(filter, search); }, [filter]);
  useEffect(() => {
    fetch('/api/crm/products?limit=500', { credentials: 'include' })
      .then(r => r.json()).then(d => setProducts((d.data ?? []).map((p: any) => ({ id: p.shopifyProductId, title: p.title, handle: p.handle }))))
      .catch(() => {});
  }, []);

  function handleSearch() { load(filter, search); }

  async function linkProduct(squareCatalogId: string, shopifyProductId: string) {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, shopifyProductId, status: 'manual' }),
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
        </div>
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-4)' }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--crm-border-light)' }}>
          {['auto', 'unmatched', 'manual', 'confirmed', 'ignored', 'all'].map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '6px 14px', fontSize: 'var(--crm-text-xs)', border: 'none', cursor: 'pointer', background: 'none',
              borderBottom: filter === t ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
              color: filter === t ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
              fontWeight: filter === t ? 500 : 400,
            }}>{STATUS_LABELS[t] ?? 'All'} {stats[t] ? `(${stats[t]})` : ''}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); handleSearch(); }} style={{ display: 'flex', gap: 4 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: 180 }} />
          <button type="submit" className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>Go</button>
        </form>
      </div>

      {/* Table */}
      {loading ? <div style={{ color: 'var(--crm-text-tertiary)' }}>Loading…</div> : (
        <div className="crm-card" style={{ overflow: 'hidden' }}>
          <table className="crm-table" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Status</th>
                <th>Square Item</th>
                <th>→ Shopify Product</th>
                <th style={{ width: 60 }}>Score</th>
                <th style={{ width: 140 }}>Actions</th>
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
                      <select
                        onChange={e => { if (e.target.value) linkProduct(m.square_catalog_id, e.target.value); }}
                        defaultValue=""
                        style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--crm-border)', width: '100%' }}
                      >
                        <option value="">Select product…</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11 }}>
                    {m.confidence ? `${Math.round(Number(m.confidence) * 100)}%` : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {m.status === 'auto' && (
                        <button onClick={() => confirm(m.square_catalog_id)} className="crm-btn crm-btn-secondary" style={{ fontSize: 10, padding: '2px 8px' }}>✓ Confirm</button>
                      )}
                      {m.shopify_title && m.status !== 'ignored' && (
                        <button onClick={() => ignore(m.square_catalog_id)} style={{ fontSize: 10, padding: '2px 8px', background: 'none', border: 'none', color: 'var(--crm-text-tertiary)', cursor: 'pointer' }}>Ignore</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {mappings.length === 0 && <div style={{ padding: 'var(--crm-space-6)', textAlign: 'center', color: 'var(--crm-text-tertiary)' }}>No items found</div>}
        </div>
      )}
    </div>
  );
}
