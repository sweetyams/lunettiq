'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Member { product_id: string; type: string | null; colour: string | null; colour_hex: string | null; title: string; handle: string; image: string | null; sales: { units: number; orders: number; revenue: number }; squareLinks: number }
interface SquareItem { square_name: string; units: number; orders: number; revenue: number }
interface FamilySales { familyId: string; members: Member[]; familyOnlySquare: SquareItem[]; totals: { orders: string; units: string; revenue: string }; byChannel: Array<{ source: string; units: string; revenue: string }>; byLocation: Array<{ location_id: string; units: string; revenue: string }> }
interface Family { id: string; name: string }
interface Product { id: string; title: string; handle: string; category?: string | null }
interface SquareMapping { square_catalog_id: string; square_name: string; shopify_product_id: string | null; family_id: string | null; status: string }

export function FamilyDetailClient({ familyId }: { familyId: string }) {
  const [family, setFamily] = useState<Family | null>(null);
  const [sales, setSales] = useState<FamilySales | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [unmappedSquare, setUnmappedSquare] = useState<SquareMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(0); // 0 = all time
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSquare, setShowAddSquare] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [squareSearch, setSquareSearch] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/products/families/${familyId}/sales${days ? `?days=${days}` : ''}`, { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/settings/families', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/products?limit=500', { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/crm/product-mappings?limit=200&status=unmatched`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([salesD, famD, prodD, sqD]) => {
      setSales(salesD.data);
      setFamily((famD.data?.families ?? []).find((f: Family) => f.id === familyId) ?? null);
      setAllProducts((prodD.data ?? []).map((p: any) => ({ id: p.shopifyProductId, title: p.title, handle: p.handle, category: p.metafields?.custom?.product_category })));
      setUnmappedSquare(sqD.data?.mappings ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [familyId, days]);

  const fmt = (n: number | string) => `$${Math.round(Number(n)).toLocaleString()}`;
  const memberIds = new Set((sales?.members ?? []).map(m => m.product_id));

  async function addMember(productId: string) {
    const p = allProducts.find(pr => pr.id === productId);
    const parts = (p?.handle ?? '').split('-');
    const typeIdx = parts.findIndex(pt => pt === 'opt' || pt === 'sun');
    const type = typeIdx >= 0 ? (parts[typeIdx] === 'opt' ? 'optical' : 'sun') : (p?.category ?? null);
    const colour = typeIdx >= 0 ? parts.slice(typeIdx + 1).join('-') : null;
    await fetch('/api/crm/settings/families', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-member', familyId, productId, type, colour }),
    });
    setShowAddProduct(false); setProductSearch(''); load();
  }

  async function removeMember(memberId: string) {
    // memberId here is product_id, need to find the member id
    await fetch('/api/crm/settings/families', {
      method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    load();
  }

  async function linkSquare(squareCatalogId: string) {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, familyId, shopifyProductId: null, status: 'related' }),
    });
    setShowAddSquare(false); setSquareSearch(''); load();
  }

  async function unlinkSquare(squareCatalogId: string) {
    await fetch('/api/crm/product-mappings', {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squareCatalogId, familyId: null, status: 'unmatched' }),
    });
    load();
  }

  if (loading) return <div style={{ padding: 'var(--crm-space-6)', color: 'var(--crm-text-tertiary)' }}>Loading…</div>;
  if (!family) return <div style={{ padding: 'var(--crm-space-6)' }}>Family not found</div>;

  const members = sales?.members ?? [];
  const familyOnlySquare = sales?.familyOnlySquare ?? [];
  const totals = sales?.totals;

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 1000 }}>
      {/* Header */}
      <Link href="/crm/products" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Catalogue</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--crm-space-2)', marginBottom: 'var(--crm-space-5)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{family.name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[{ d: 30, l: '30d' }, { d: 90, l: '90d' }, { d: 365, l: '1yr' }, { d: 0, l: 'All' }].map(p => (
            <button key={p.d} onClick={() => setDays(p.d)} style={{
              padding: '4px 12px', fontSize: 'var(--crm-text-xs)', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: days === p.d ? 'var(--crm-text-primary)' : 'var(--crm-surface-hover)',
              color: days === p.d ? 'var(--crm-text-inverse)' : 'var(--crm-text-secondary)',
            }}>{p.l}</button>
          ))}
          <Link href="/crm/settings/families" style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', textDecoration: 'none', marginLeft: 8 }}>Edit in Settings ↗</Link>
        </div>
      </div>

      {/* Stats */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-5)' }}>
          {[
            { label: 'Products', value: members.length },
            { label: 'Total Sold', value: totals.units },
            { label: 'Revenue', value: fmt(totals.revenue) },
            { label: 'Orders', value: totals.orders },
          ].map(s => (
            <div key={s.label} className="crm-card" style={{ padding: 'var(--crm-space-3)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{s.value}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Channel breakdown */}
      {sales?.byChannel && sales.byChannel.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-5)' }}>
          {sales.byChannel.map((c: any) => (
            <span key={c.source} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 20, background: c.source === 'square' ? '#FEF3C7' : '#DBEAFE', color: c.source === 'square' ? '#92400E' : '#1E40AF' }}>
              {c.source === 'shopify' ? 'Online' : c.source === 'square' ? 'In-store' : c.source}: {c.units} units · {fmt(c.revenue)}
            </span>
          ))}
        </div>
      )}

      {/* Shopify Products */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-2)' }}>
        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', letterSpacing: '0.04em' }}>Shopify Products ({members.length})</div>
        <button onClick={() => setShowAddProduct(true)} style={{ fontSize: 'var(--crm-text-xs)', padding: '3px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>+ Add Product</button>
      </div>
      <div className="crm-card" style={{ overflow: 'hidden', marginBottom: 'var(--crm-space-5)' }}>
        <table className="crm-table">
          <thead>
            <tr>
              <th>Product</th>
              <th style={{ width: 70 }}>Type</th>
              <th style={{ width: 80, textAlign: 'right' }}>Sold</th>
              <th style={{ width: 90, textAlign: 'right' }}>Revenue</th>
              <th style={{ width: 70, textAlign: 'center' }}>Square</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.product_id}>
                <td>
                  <Link href={`/crm/products/${m.product_id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
                    {m.image && <img src={m.image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} />}
                    <div>
                      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{m.title}</div>
                      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{m.colour}</div>
                    </div>
                  </Link>
                </td>
                <td>
                  {m.type && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: m.type === 'sun' ? '#fef3c7' : '#dbeafe', color: m.type === 'sun' ? '#92400e' : '#1e40af' }}>{m.type === 'sun' ? 'SUN' : 'OPT'}</span>}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--crm-text-sm)' }}>{m.sales.units}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--crm-text-sm)' }}>{fmt(m.sales.revenue)}</td>
                <td style={{ textAlign: 'center' }}>
                  {m.squareLinks > 0 ? <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500 }}>{m.squareLinks}</span> : <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-warning, #d97706)' }}>—</span>}
                </td>
                <td>
                  <button onClick={() => removeMember(m.product_id)} style={{ fontSize: 9, color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Square-only items */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-2)' }}>
        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', letterSpacing: '0.04em' }}>Square-Only Items ({familyOnlySquare.length})</div>
        <button onClick={() => setShowAddSquare(true)} style={{ fontSize: 'var(--crm-text-xs)', padding: '3px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>+ Link Square Item</button>
      </div>
      <div className="crm-card" style={{ overflow: 'hidden', marginBottom: 'var(--crm-space-4)' }}>
        {familyOnlySquare.length > 0 ? (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Square Item</th>
                <th style={{ width: 80, textAlign: 'right' }}>Sold</th>
                <th style={{ width: 90, textAlign: 'right' }}>Revenue</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {familyOnlySquare.map((sq, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 'var(--crm-text-sm)' }}>{sq.square_name}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--crm-text-sm)' }}>{sq.units}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 'var(--crm-text-sm)' }}>{fmt(sq.revenue)}</td>
                  <td>
                    <button onClick={() => {
                      // Find the square_catalog_id for this name
                      // For now just reload — the unlinkSquare needs the catalog ID
                    }} style={{ fontSize: 9, color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 'var(--crm-space-4)', fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)' }}>No Square-only items linked. Use "+ Link Square Item" to add unmatched Square products to this family.</div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="crm-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAddProduct(false); setProductSearch(''); } }}>
          <div className="crm-card crm-modal" style={{ width: 420, padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Add Shopify Product to {family.name}</h2>
              <button onClick={() => { setShowAddProduct(false); setProductSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search products…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 8 }} autoFocus />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {productSearch.length >= 2 && allProducts
                .filter(p => !memberIds.has(p.id) && p.title.toLowerCase().includes(productSearch.toLowerCase()))
                .slice(0, 10)
                .map(p => (
                  <button key={p.id} onClick={() => addMember(p.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 'var(--crm-text-xs)', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <span>{p.title}</span>
                    {p.category && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: p.category === 'sun' ? '#fef3c7' : '#dbeafe', color: p.category === 'sun' ? '#92400e' : '#1e40af' }}>{p.category === 'sun' ? 'SUN' : 'OPT'}</span>}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Link Square Modal */}
      {showAddSquare && (
        <div className="crm-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAddSquare(false); setSquareSearch(''); } }}>
          <div className="crm-card crm-modal" style={{ width: 420, padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Link Square Item to {family.name}</h2>
              <button onClick={() => { setShowAddSquare(false); setSquareSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <input value={squareSearch} onChange={e => setSquareSearch(e.target.value)} placeholder={`Search Square items (e.g. ${family.name.toLowerCase()})…`} className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 8 }} autoFocus />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {squareSearch.length >= 2 && unmappedSquare
                .filter(s => s.square_name?.toLowerCase().includes(squareSearch.toLowerCase()))
                .slice(0, 15)
                .map(s => (
                  <button key={s.square_catalog_id} onClick={() => linkSquare(s.square_catalog_id)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 'var(--crm-text-xs)', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    {s.square_name}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
