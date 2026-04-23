'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { InlineProductPicker } from '@/components/crm/InlineProductPicker';
import { useToast } from '@/components/crm/CrmShell';

interface Family { id: string; name: string }
interface Member { id: string; family_id: string; product_id: string; type: string | null; colour: string | null; colour_hex: string | null; sort_order: number; handle: string; title: string; image: string | null; status: string; barcode: string | null; default_lens_type: string | null; default_lens_colour: string | null; convertible_to_optical: boolean | null; convertible_to_sun: boolean | null }
interface UnassignedProduct { id: string; handle: string; title: string; image: string | null; status: string }

export default function FamiliesPage() {
  const { toast } = useToast();
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedProduct[]>([]);
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newFamily, setNewFamily] = useState({ id: '', name: '' });
  const [search, setSearch] = useState('');
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddSquare, setShowAddSquare] = useState(false);
  const [linkFilter, setLinkFilter] = useState<'all' | 'shopify' | 'square'>('shopify');
  const [memberSearch, setMemberSearch] = useState('');
  const [squareSearch, setSquareSearch] = useState('');
  const [squareItems, setSquareItems] = useState<Array<{ squareCatalogId: string; squareName: string; parsedFrame: string | null; parsedColour: string | null; parsedType: string | null }>>([]);
  const [memberSort, setMemberSort] = useState<'colour' | 'type'>('colour');
  const [allProducts, setAllProducts] = useState<Array<{ id: string; title: string; handle: string; status: string | null }>>([]);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/crm/settings/families', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setFamilies(d.data?.families ?? []); setMembers(d.data?.members ?? []); setUnassigned(d.data?.unassigned ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function autoAssignAll() {
    setAutoAssigning(true);
    try {
      const res = await fetch('/api/crm/settings/families/auto-assign', { method: 'POST', credentials: 'include' });
      const d = await res.json();
      toast(d.data?.message ?? 'Done');
      load();
    } catch { toast('Auto-assign failed', 'error'); }
    setAutoAssigning(false);
  }

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/crm/products?limit=500&status=active,draft', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAllProducts((d.data ?? []).map((p: any) => ({ id: p.shopifyProductId, title: p.title, handle: p.handle, status: p.status }))))
      .catch(() => {});
  }, []);

  const familyMembers = activeFamily ? members.filter(m => m.family_id === activeFamily).sort((a, b) => memberSort === 'colour' ? ((a.colour ?? '').localeCompare(b.colour ?? '') || (a.type ?? '').localeCompare(b.type ?? '')) : ((a.type ?? '').localeCompare(b.type ?? '') || (a.colour ?? '').localeCompare(b.colour ?? ''))) : [];
  const filteredFamilies = families.filter(f => {
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (linkFilter === 'all') return true;
    const fMembers = members.filter(m => m.family_id === f.id);
    const hasShopify = fMembers.some(m => !m.product_id.startsWith('sq__'));
    return linkFilter === 'shopify' ? hasShopify : !hasShopify;
  });
  const memberProductIds = new Set(activeFamily ? familyMembers.map(m => m.product_id) : []);
  const searchedProducts = memberSearch.length >= 2
    ? allProducts.filter(p => !memberProductIds.has(p.id) && p.title.toLowerCase().includes(memberSearch.toLowerCase())).slice(0, 10)
    : [];

  async function addFamily() {
    if (!newFamily.name) return;
    const id = newFamily.id || newFamily.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
    await fetch('/api/crm/settings/families', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert-family', id, name: newFamily.name }),
    });
    setNewFamily({ id: '', name: '' }); setShowAdd(false); load();
  }

  async function deleteFamily(id: string) {
    if (!confirm(`Delete family "${id}" and all members?`)) return;
    await fetch('/api/crm/settings/families', {
      method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: id }),
    });
    if (activeFamily === id) setActiveFamily(null);
    load();
  }

  async function addMember(productId: string) {
    if (!activeFamily) return;
    // Derive type and colour from handle
    const product = allProducts.find(p => p.id === productId);
    let type: string | null = null;
    let colour: string | null = null;
    if (product) {
      const clean = product.handle.replace(/©/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
      const parts = clean.split('-');
      const typeIdx = parts.findIndex(p => p === 'opt' || p === 'sun');
      if (typeIdx >= 0) {
        type = parts[typeIdx] === 'opt' ? 'optical' : 'sun';
        colour = parts.slice(typeIdx + 1).filter(s => !/^\d+$/.test(s)).join('-') || null;
      } else if (parts.length >= 2) {
        colour = parts.slice(1).filter(s => !/^\d+$/.test(s) && !['optics', 'sunglasses'].includes(s)).join('-') || null;
        type = (product.handle.includes('sunglasses') || product.handle.includes('-sun')) ? 'sun' : 'optical';
      }
    }
    await fetch('/api/crm/settings/families', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-member', familyId: activeFamily, productId, type, colour }),
    });
    load();
  }

  async function removeMember(memberId: string) {
    await fetch('/api/crm/settings/families', {
      method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    load();
  }

  async function assignToFamily(productId: string, familyId: string) {
    const product = allProducts.find(p => p.id === productId) ?? unassigned.find(p => p.id === productId);
    let type: string | null = null;
    let colour: string | null = null;
    if (product) {
      const parts = product.handle.split('-');
      const typeIdx = parts.findIndex((p: string) => p === 'opt' || p === 'sun');
      if (typeIdx >= 0) {
        type = parts[typeIdx] === 'opt' ? 'optical' : 'sun';
        colour = parts.slice(typeIdx + 1).join('-');
      }
    }
    await fetch('/api/crm/settings/families', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-member', familyId, productId, type, colour }),
    });
    load();
  }

  async function updateMember(memberId: string, field: string, value: string | boolean) {
    await fetch('/api/crm/settings/families', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-member', id: memberId, [field]: value }),
    });
    // Update local state instead of full reload
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, [field]: value } : m));
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ marginBottom: 'var(--crm-space-4)' }}>
        <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Product Families</h1>
          {unassigned.length > 0 && (
            <button onClick={autoAssignAll} disabled={autoAssigning} className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>
              {autoAssigning ? 'Assigning…' : `Auto-assign ${unassigned.length} unassigned`}
            </button>
          )}
        </div>
        <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
          Group products by model. Shown as colour/type switcher on PDP.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 'var(--crm-space-4)' }}>
        {/* Left: families list */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-3)', alignSelf: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)' }}>Families ({families.length})</span>
            <button onClick={() => setShowAdd(true)} style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>+ Add</button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {([['shopify', 'Shopify'], ['square', 'Square'], ['all', 'All']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setLinkFilter(key)} style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 4, cursor: 'pointer', border: 'none',
                background: linkFilter === key ? (key === 'square' ? '#fef3c7' : key === 'shopify' ? '#dbeafe' : 'var(--crm-text-primary)') : 'var(--crm-surface-hover)',
                color: linkFilter === key ? (key === 'square' ? '#92400e' : key === 'shopify' ? '#1e40af' : '#fff') : 'var(--crm-text-tertiary)',
                fontWeight: linkFilter === key ? 600 : 400,
              }}>{label}</button>
            ))}
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filteredFamilies.map(f => {
              const fMembers = members.filter(m => m.family_id === f.id);
              const count = fMembers.length;
              const hasShopify = fMembers.some(m => !m.product_id.startsWith('sq__'));
              const missingColour = fMembers.filter(m => !m.colour).length;
              return (
                <div key={f.id} onClick={() => setActiveFamily(activeFamily === f.id ? null : f.id)} style={{
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: activeFamily === f.id ? 'var(--crm-surface-hover)' : 'none',
                }}>
                  <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasShopify ? '#16a34a' : '#F59E0B', flexShrink: 0 }} />
                    {f.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>{count}</span>
                    {missingColour > 0 && <span title={`${missingColour} member${missingColour > 1 ? 's' : ''} missing colour`} style={{ fontSize: 9, padding: '0 4px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600, cursor: 'help' }}>⚠ {missingColour}</span>}
                    <button onClick={e => { e.stopPropagation(); deleteFamily(f.id); }} style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
          {showAdd && (
            <div style={{ marginTop: 'var(--crm-space-3)', padding: 'var(--crm-space-3)', border: '1px solid var(--crm-border)', borderRadius: 6 }}>
              <input value={newFamily.name} onChange={e => setNewFamily({ name: e.target.value, id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') })}
                placeholder="Family name (e.g. SHELBY)" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={addFamily} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--crm-text-primary)', color: 'white', cursor: 'pointer' }}>Add</button>
                <button onClick={() => setShowAdd(false)} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          {/* Unassigned */}
          {unassigned.length > 0 && (
            <div onClick={() => setActiveFamily(activeFamily === '__unassigned' ? null : '__unassigned')} style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 8, borderTop: '1px solid var(--crm-border-light)', paddingTop: 12,
              background: activeFamily === '__unassigned' ? 'var(--crm-surface-hover)' : 'none',
            }}>
              <span style={{ fontSize: 'var(--crm-text-sm)', color: '#dc2626' }}>Unassigned</span>
              <span style={{ fontSize: 10, color: '#dc2626' }}>{unassigned.length}</span>
            </div>
          )}
        </div>

        {/* Right: members */}
        <div style={{ padding: 'var(--crm-space-3)' }}>
          {!activeFamily ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>Select a family to manage members</div>
          ) : activeFamily === '__unassigned' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
                <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>Unassigned Products ({unassigned.length})</span>
              </div>
              <table className="crm-table" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ width: 180 }}>Assign to Family</th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {p.image && <img src={p.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} />}
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              {p.title}
                              {p.status && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: p.status === 'active' ? '#95FFB9' : p.status === 'draft' ? '#CFEDFF' : '#f3f4f6', color: p.status === 'active' ? '#065f46' : p.status === 'draft' ? '#1e40af' : '#6b7280', fontWeight: 600 }}>{p.status}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select defaultValue="" onChange={e => { if (e.target.value) { assignToFamily(p.id, e.target.value); e.target.value = ''; } }}
                          className="crm-input"
                          style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 8px' }}>
                          <option value="">Select…</option>
                          {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
                <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>
                  {families.find(f => f.id === activeFamily)?.name} — {familyMembers.length} products
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <select value={memberSort} onChange={e => setMemberSort(e.target.value as any)} className="crm-input" style={{ fontSize: 10, padding: '4px 8px' }}>
                    <option value="colour">Sort: Colour</option>
                    <option value="type">Sort: Type</option>
                  </select>
                  <button onClick={() => setShowAddMember(true)} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>+ Shopify</button>
                  <button onClick={() => { setShowAddSquare(true); if (!squareItems.length) fetch('/api/crm/product-mappings?limit=500&status=unmatched', { credentials: 'include' }).then(r => r.json()).then(d => setSquareItems(d.data?.mappings ?? [])).catch(() => {}); }} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid #F59E0B', background: '#FFFBEB', color: '#92400E', cursor: 'pointer' }}>+ Square</button>
                </div>
              </div>

              {/* Colour swatch preview */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--crm-space-3)', flexWrap: 'wrap' }}>
                {familyMembers.filter(m => m.type !== 'sun' || !familyMembers.some(o => o.colour === m.colour && o.type === 'optical')).map(m => (
                  <div key={m.id} style={{ width: 24, height: 24, borderRadius: '50%', background: m.colour_hex || '#ccc', border: '2px solid #e5e7eb' }} title={m.colour ?? m.handle} />
                ))}
              </div>

              {/* Members table */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280' }}>Product</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 70 }}>Type</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, fontSize: 10, color: '#6b7280', width: 90 }}>Colour</th>
                      <th style={{ padding: '6px 10px', width: 30 }}></th>
                      <th style={{ padding: '6px 10px', width: 30 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMembers.map(m => (
                      <React.Fragment key={m.id}>
                      <tr style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => setExpandedMember(expandedMember === m.id ? null : m.id)}>
                        <td style={{ padding: '6px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {m.image ? <img src={m.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} /> : <div style={{ width: 32, height: 32, borderRadius: 4, background: '#f5f5f5' }} />}
                            <span style={{ fontWeight: 500 }}>{m.title}</span>
                            {m.status && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: m.status === 'active' ? '#95FFB9' : m.status === 'draft' ? '#CFEDFF' : '#f3f4f6', color: m.status === 'active' ? '#065f46' : m.status === 'draft' ? '#1e40af' : '#6b7280', fontWeight: 600 }}>{m.status}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <select value={m.type ?? ''} onChange={e => updateMember(m.id, 'type', e.target.value)} className="crm-input" style={{ fontSize: 10, padding: '2px 20px 2px 4px', width: '100%' }}>
                            <option value="optical">Optical</option>
                            <option value="sun">Sun</option>
                          </select>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <DebouncedInput value={m.colour ?? ''} onSave={v => updateMember(m.id, 'colour', v)} className="crm-input" placeholder="colour" style={{ fontSize: 10, width: '100%', padding: '2px 4px', ...(m.colour ? {} : { borderColor: '#f59e0b', background: '#fffbeb' }) }} />
                            <input type="color" value={m.colour_hex ?? '#cccccc'} onChange={e => updateMember(m.id, 'colourHex', e.target.value)} style={{ width: 20, height: 20, border: '1px solid #e5e7eb', borderRadius: 3, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                            {!m.colour && <span title="No colour — inventory will track as unassigned" style={{ fontSize: 12, cursor: 'help', flexShrink: 0 }}>⚠️</span>}
                          </div>
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <button onClick={() => removeMember(m.id)} style={{ fontSize: 10, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer' }} title="Remove">✕</button>
                        </td>
                      </tr>
                      {expandedMember === m.id && (
                        <tr style={{ background: '#fafafa' }}>
                          <td colSpan={5} style={{ padding: '10px 10px 10px 50px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 11 }}>
                              <div>
                                <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Barcode</label>
                                <DebouncedInput className="crm-input" style={{ width: '100%', fontSize: 11 }} value={m.barcode ?? ''} onSave={v => updateMember(m.id, 'barcode', v)} placeholder="Scan or enter" />
                              </div>
                              <div>
                                <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Default Lens Type</label>
                                <DebouncedInput className="crm-input" style={{ width: '100%', fontSize: 11 }} value={m.default_lens_type ?? ''} onSave={v => updateMember(m.id, 'defaultLensType', v)} placeholder="e.g. Sun, Clear" />
                              </div>
                              <div>
                                <label style={{ fontSize: 10, color: '#9ca3af', display: 'block', marginBottom: 2 }}>Default Lens Colour</label>
                                <DebouncedInput className="crm-input" style={{ width: '100%', fontSize: 11 }} value={m.default_lens_colour ?? ''} onSave={v => updateMember(m.id, 'defaultLensColour', v)} placeholder="e.g. Grey, Brown" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add member modal */}
      {showAddMember && (
        <div className="crm-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddMember(false); }}>
          <div className="crm-card crm-modal" style={{ width: 600, padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Add Product to {families.find(f => f.id === activeFamily)?.name}</h2>
              <button onClick={() => setShowAddMember(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <InlineProductPicker excludeIds={memberProductIds} onSelect={id => { addMember(id); setShowAddMember(false); }} />
          </div>
        </div>
      )}

      {/* Add Square item modal */}
      {showAddSquare && (
        <div className="crm-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAddSquare(false); setSquareSearch(''); } }}>
          <div className="crm-card crm-modal" style={{ width: 440, padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Add Square Item to {families.find(f => f.id === activeFamily)?.name}</h2>
              <button onClick={() => { setShowAddSquare(false); setSquareSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <input value={squareSearch} onChange={e => setSquareSearch(e.target.value)} placeholder="Search Square items…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 8 }} autoFocus />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {squareItems
                .filter(s => squareSearch.length >= 2 && (s.squareName ?? '').toLowerCase().includes(squareSearch.toLowerCase()))
                .slice(0, 15)
                .map(s => (
                <button key={s.squareCatalogId} onClick={async () => {
                  await fetch('/api/crm/settings/families', {
                    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'add-square-member', familyId: activeFamily, squareCatalogId: s.squareCatalogId, squareName: s.squareName, type: s.parsedType === 'sun' ? 'sun' : 'optical', colour: s.parsedColour }),
                  });
                  load();
                }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 'var(--crm-text-xs)', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ fontWeight: 500 }}>{s.squareName}</div>
                  <div style={{ color: 'var(--crm-text-tertiary)', display: 'flex', gap: 6 }}>
                    {s.parsedColour && <span>{s.parsedColour}</span>}
                    {s.parsedType && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: s.parsedType === 'sun' ? '#fef3c7' : '#dbeafe', color: s.parsedType === 'sun' ? '#92400e' : '#1e40af' }}>{s.parsedType}</span>}
                  </div>
                </button>
              ))}
              {squareSearch.length >= 2 && squareItems.filter(s => (s.squareName ?? '').toLowerCase().includes(squareSearch.toLowerCase())).length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>No unmatched Square items found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DebouncedInput({ value: initial, onSave, ...props }: { value: string; onSave: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const [value, setValue] = useState(initial);
  const dirty = useRef(false);
  return <input {...props} value={value} onChange={e => { setValue(e.target.value); dirty.current = true; }} onBlur={() => { if (dirty.current) { onSave(value); dirty.current = false; } }} onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }} />;
}