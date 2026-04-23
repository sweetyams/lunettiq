'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { InlineProductPicker } from '@/components/crm/InlineProductPicker';

interface Member { productId: string; type: string | null; colour: string | null; colour_hex: string | null; title: string; handle: string; image: string | null; productStatus: string | null; sales: { units: number; orders: number; revenue: number }; squareLinks: number }
interface SquareItem { square_name: string; units: number; orders: number; revenue: number }
interface FamilySales { familyId: string; members: Member[]; familyOnlySquare: SquareItem[]; totals: { orders: string; units: string; revenue: string }; byChannel: Array<{ source: string; units: string; revenue: string }>; byLocation: Array<{ location_id: string; units: string; revenue: string }> }
interface Family { id: string; name: string }
interface Product { id: string; title: string; handle: string; category?: string | null; status?: string | null }
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
  const [memberSort, setMemberSort] = useState<'colour' | 'type'>('colour');
  const [productSearch, setProductSearch] = useState('');
  const [squareSearch, setSquareSearch] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/crm/products/families/${familyId}/sales${days ? `?days=${days}` : ''}`, { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/settings/families', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/crm/products?limit=500&status=active,draft', { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/crm/product-mappings?limit=200&status=unmatched`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([salesD, famD, prodD, sqD]) => {
      setSales(salesD.data);
      setFamily((famD.data?.families ?? []).find((f: Family) => f.id === familyId) ?? null);
      setAllProducts((prodD.data ?? []).map((p: any) => ({ id: p.shopifyProductId, title: p.title, handle: p.handle, category: p.metafields?.custom?.product_type ?? p.metafields?.custom?.product_category, status: p.status })));
      setUnmappedSquare(sqD.data?.mappings ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [familyId, days]);

  const fmt = (n: number | string) => `$${Math.round(Number(n)).toLocaleString()}`;
  const memberIds = new Set((sales?.members ?? []).map(m => m.productId));

  async function addMember(productId: string) {
    const p = allProducts.find(pr => pr.id === productId);
    // Derive type from product_category metafield first, then parse handle
    let type: string | null = p?.category ?? null;
    let colour: string | null = null;
    const handle = p?.handle ?? '';
    const clean = handle.replace(/©/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
    const parts = clean.split('-');
    const typeIdx = parts.findIndex(pt => pt === 'opt' || pt === 'sun');
    if (typeIdx >= 0) {
      if (!type) type = parts[typeIdx] === 'opt' ? 'optical' : 'sun';
      colour = parts.slice(typeIdx + 1).filter(s => !/^\d+$/.test(s)).join('-') || null;
    } else if (parts.length >= 2) {
      // Handle like "jackson-©-moka" → after clean: "jackson-moka"
      colour = parts.slice(1).filter(s => !/^\d+$/.test(s) && !['optics', 'sunglasses'].includes(s)).join('-') || null;
      if (!type && (handle.includes('sunglasses') || handle.includes('-sun'))) type = 'sun';
      if (!type) type = 'optical';
    }
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

  const members = (sales?.members ?? []).sort((a, b) => memberSort === 'colour' ? ((a.colour ?? '').localeCompare(b.colour ?? '') || (a.type ?? '').localeCompare(b.type ?? '')) : ((a.type ?? '').localeCompare(b.type ?? '') || (a.colour ?? '').localeCompare(b.colour ?? '')));
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

      {/* Inventory by colour × location */}
      <FamilyInventoryGrid familyId={familyId} />

      {/* Shopify Products */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-2)' }}>
        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', letterSpacing: '0.04em' }}>Shopify Products ({members.length})</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <select value={memberSort} onChange={e => setMemberSort(e.target.value as any)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--crm-border, #e5e7eb)', background: 'none' }}>
            <option value="colour">Sort: Colour</option>
            <option value="type">Sort: Type</option>
          </select>
          <button onClick={() => setShowAddProduct(true)} style={{ fontSize: 'var(--crm-text-xs)', padding: '3px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>+ Add Product</button>
        </div>
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
            {members.map(m => {
              const isPlaceholder = m.productId.startsWith('sq__');
              return (
              <tr key={m.productId}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isPlaceholder ? (
                      <div style={{ width: 36, height: 36, borderRadius: 4, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>■</div>
                    ) : m.image ? (
                      <Link href={`/crm/products/${m.productId}`}><img src={m.image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} /></Link>
                    ) : null}
                    <div>
                      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>
                        {isPlaceholder ? <>{m.title} <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', marginLeft: 4 }}>SQUARE</span></> : (
                          <Link href={`/crm/products/${m.productId}`} style={{ textDecoration: 'none', color: 'inherit' }}>{m.title}</Link>
                        )}
                        {m.productStatus && <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: m.productStatus === 'active' ? '#95FFB9' : m.productStatus === 'draft' ? '#CFEDFF' : '#f3f4f6', color: m.productStatus === 'active' ? '#065f46' : m.productStatus === 'draft' ? '#1e40af' : '#6b7280', fontWeight: 600 }}>{m.productStatus}</span>}
                      </div>
                      <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{m.colour}</div>
                    </div>
                  </div>
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
                  <button onClick={() => removeMember(m.productId)} style={{ fontSize: 9, color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </td>
              </tr>
              );
            })}
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
          onClick={e => { if (e.target === e.currentTarget) setShowAddProduct(false); }}>
          <div className="crm-card crm-modal" style={{ width: 600, padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Add Shopify Product to {family.name}</h2>
              <button onClick={() => setShowAddProduct(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <InlineProductPicker excludeIds={memberIds} onSelect={id => { addMember(id); setShowAddProduct(false); }} />
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

function FamilyInventoryGrid({ familyId }: { familyId: string }) {
  const [levels, setLevels] = useState<Array<{ familyId: string | null; colour: string | null; locationId: string; locationName: string; onHand: number; available: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/crm/inventory?familyId=${familyId}`, { credentials: 'include' })
      .then(r => r.json()).then(d => setLevels(d.data ?? []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [familyId]);

  if (loading || !levels.length) return null;

  const colours = Array.from(new Set(levels.map(l => l.colour).filter(Boolean))) as string[];
  const locations = Array.from(new Set(levels.map(l => l.locationName)));

  if (!colours.length || !locations.length) return null;

  const getAvailable = (colour: string, loc: string) => {
    const l = levels.find(x => x.colour === colour && x.locationName === loc);
    return l?.available ?? 0;
  };

  return (
    <div style={{ marginBottom: 'var(--crm-space-5)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--crm-text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stock by Colour</div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Colour</th>
              {locations.map(loc => (
                <th key={loc} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>{loc}</th>
              ))}
              <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {colours.map(colour => {
              const total = locations.reduce((s, loc) => s + getAvailable(colour, loc), 0);
              return (
                <tr key={colour} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 500, textTransform: 'capitalize' }}>{colour.replace(/-/g, ' ')}</td>
                  {locations.map(loc => {
                    const avail = getAvailable(colour, loc);
                    return <td key={loc} style={{ padding: '6px 10px', textAlign: 'right', color: avail > 0 ? '#065f46' : '#dc2626', fontWeight: avail > 0 ? 400 : 600 }}>{avail}</td>;
                  })}
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
