'use client';

import { useEffect, useState, useCallback } from 'react';

interface Family { id: string; name: string }
interface Member { id: string; family_id: string; product_id: string; type: string | null; colour: string | null; colour_hex: string | null; sort_order: number; handle: string; title: string; image: string | null; status: string }

export default function FamiliesPage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newFamily, setNewFamily] = useState({ id: '', name: '' });
  const [search, setSearch] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [allProducts, setAllProducts] = useState<Array<{ id: string; title: string; handle: string }>>([]);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/crm/settings/families', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setFamilies(d.data?.families ?? []); setMembers(d.data?.members ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/crm/products?limit=500', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setAllProducts((d.data ?? []).map((p: any) => ({ id: p.shopifyProductId, title: p.title, handle: p.handle }))))
      .catch(() => {});
  }, []);

  const familyMembers = activeFamily ? members.filter(m => m.family_id === activeFamily) : [];
  const filteredFamilies = search ? families.filter(f => f.name.toLowerCase().includes(search.toLowerCase())) : families;
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
      const parts = product.handle.split('-');
      const typeIdx = parts.findIndex(p => p === 'opt' || p === 'sun');
      if (typeIdx >= 0) {
        type = parts[typeIdx] === 'opt' ? 'optical' : 'sun';
        colour = parts.slice(typeIdx + 1).join('-');
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

  async function updateMember(memberId: string, field: string, value: string) {
    await fetch('/api/crm/settings/families', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-member', id: memberId, [field]: value }),
    });
    load();
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ marginBottom: 'var(--crm-space-4)' }}>
        <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Product Families</h1>
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 8 }} />
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filteredFamilies.map(f => {
              const count = members.filter(m => m.family_id === f.id).length;
              return (
                <div key={f.id} onClick={() => setActiveFamily(activeFamily === f.id ? null : f.id)} style={{
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: activeFamily === f.id ? 'var(--crm-surface-hover)' : 'none',
                }}>
                  <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>{f.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>{count}</span>
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
        </div>

        {/* Right: members */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-3)' }}>
          {!activeFamily ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>Select a family to manage members</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
                <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>
                  {families.find(f => f.id === activeFamily)?.name} — {familyMembers.length} products
                </span>
                <button onClick={() => setShowAddMember(true)} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>+ Add Product</button>
              </div>

              {/* Colour swatch preview */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--crm-space-3)', flexWrap: 'wrap' }}>
                {familyMembers.filter(m => m.type !== 'sun' || !familyMembers.some(o => o.colour === m.colour && o.type === 'optical')).map(m => (
                  <div key={m.id} style={{ width: 24, height: 24, borderRadius: '50%', background: m.colour_hex || '#ccc', border: '2px solid #e5e7eb' }} title={m.colour ?? m.handle} />
                ))}
              </div>

              <table className="crm-table" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ width: 80 }}>Type</th>
                    <th style={{ width: 120 }}>Colour</th>
                    <th style={{ width: 80 }}>Swatch</th>
                    <th style={{ width: 60 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {familyMembers.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {m.image && <img src={m.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} />}
                          <div>
                            <div style={{ fontWeight: 500 }}>{m.title}</div>
                            <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{m.handle}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select value={m.type ?? ''} onChange={e => updateMember(m.id, 'type', e.target.value)}
                          style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 4px', border: '1px solid var(--crm-border)', borderRadius: 4 }}>
                          <option value="optical">Optical</option>
                          <option value="sun">Sun</option>
                        </select>
                      </td>
                      <td>
                        <input value={m.colour ?? ''} onChange={e => updateMember(m.id, 'colour', e.target.value)}
                          style={{ fontSize: 'var(--crm-text-xs)', width: 100, padding: '2px 6px', border: '1px solid var(--crm-border)', borderRadius: 4 }} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="color" value={m.colour_hex ?? '#cccccc'} onChange={e => updateMember(m.id, 'colourHex', e.target.value)}
                            style={{ width: 24, height: 24, border: 'none', cursor: 'pointer', padding: 0 }} />
                          <span style={{ fontSize: 9, color: 'var(--crm-text-tertiary)' }}>{m.colour_hex ?? ''}</span>
                        </div>
                      </td>
                      <td>
                        <button onClick={() => removeMember(m.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid #dc2626', background: 'none', color: '#dc2626', cursor: 'pointer' }}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* Add member modal */}
      {showAddMember && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAddMember(false); setMemberSearch(''); } }}>
          <div className="crm-card" style={{ width: 400, padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Add Product to {families.find(f => f.id === activeFamily)?.name}</h2>
              <button onClick={() => { setShowAddMember(false); setMemberSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search products…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 8 }} autoFocus />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {searchedProducts.map(p => (
                <button key={p.id} onClick={() => { addMember(p.id); setMemberSearch(''); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 'var(--crm-text-xs)', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ fontWeight: 500 }}>{p.title}</div>
                  <div style={{ color: 'var(--crm-text-tertiary)' }}>{p.handle}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
