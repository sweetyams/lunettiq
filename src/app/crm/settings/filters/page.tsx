'use client';

import { useEffect, useState, useCallback } from 'react';

interface FilterGroup { id: string; type: string; slug: string; label: string; sortOrder: number | null }
interface Assignment { id: string; product_id: string; filter_group_id: string; status: string; matched_by: string | null; handle: string; title: string; image: string | null }
interface UnassignedProduct { id: string; handle: string; title: string; image: string | null; status: string }

const STATUS_COLOURS: Record<string, string> = { auto: '#f59e0b', confirmed: '#16a34a', manual: '#8b5cf6' };
const STATUS_LABELS: Record<string, string> = { auto: 'Auto', confirmed: 'Confirmed', manual: 'Manual' };

export default function FiltersPage() {
  const [groups, setGroups] = useState<FilterGroup[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedProduct[]>([]);
  const [activeType, setActiveType] = useState<string>('colour');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [newGroup, setNewGroup] = useState({ slug: '', label: '' });
  const [assignSearch, setAssignSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/crm/settings/filters?type=${activeType}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setGroups(d.data?.groups ?? []); setAssignments(d.data?.assignments ?? []); setUnassigned(d.data?.unassigned ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeType]);

  useEffect(() => { load(); }, [load]);

  const types = Array.from(new Set(groups.map(g => g.type))).sort();
  if (!types.includes(activeType) && types.length > 0 && !loading) {
    // keep activeType even if no groups yet
  }
  const allTypes = Array.from(new Set([...types, 'colour', 'shape', 'size', 'material'])).sort();

  const typeGroups = groups.filter(g => g.type === activeType);
  const groupAssignments = activeGroup === '__unassigned'
    ? []
    : activeGroup
      ? assignments.filter(a => a.filter_group_id === activeGroup)
      : assignments;

  async function addGroup() {
    if (!newGroup.slug || !newGroup.label) return;
    await fetch('/api/crm/settings/filters', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upsert-group', type: activeType, slug: newGroup.slug, label: newGroup.label, sortOrder: typeGroups.length + 1 }),
    });
    setNewGroup({ slug: '', label: '' });
    setShowAddGroup(false);
    load();
  }

  async function deleteGroup(id: string) {
    if (!confirm(`Delete filter group "${id}" and all its assignments?`)) return;
    await fetch('/api/crm/settings/filters', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filterGroupId: id }),
    });
    if (activeGroup === id) setActiveGroup(null);
    load();
  }

  async function confirmAssignment(id: string) {
    await fetch('/api/crm/settings/filters', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', id }),
    });
    load();
  }

  async function removeAssignment(productId: string, filterGroupId: string) {
    await fetch('/api/crm/settings/filters', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, filterGroupId }),
    });
    load();
  }

  async function assignProduct(productId: string) {
    if (!activeGroup) return;
    await fetch('/api/crm/settings/filters', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', productId, filterGroupId: activeGroup }),
    });
    setShowAssign(false);
    setAssignSearch('');
    load();
  }

  async function assignToGroup(productId: string, filterGroupId: string) {
    await fetch('/api/crm/settings/filters', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', productId, filterGroupId }),
    });
    load();
  }

  async function confirmAll() {
    const autoAssignments = groupAssignments.filter(a => a.status === 'auto');
    for (const a of autoAssignments) {
      await fetch('/api/crm/settings/filters', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', id: a.id }),
      });
    }
    load();
  }

  const assignedProductIds = new Set(assignments.map(a => a.product_id));
  const filteredProducts = assignSearch.length >= 2
    ? unassigned.filter(p => p.title.toLowerCase().includes(assignSearch.toLowerCase())).slice(0, 10)
    : [];

  const autoCount = groupAssignments.filter(a => a.status === 'auto').length;

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--crm-space-4)' }}>
        <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Product Filters</h1>
        <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
          Manage filter groups and assign products. Changes reflect on storefront immediately.
        </p>
      </div>

      {/* Type tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--crm-border-light)', marginBottom: 'var(--crm-space-4)' }}>
        {allTypes.map(t => (
          <button key={t} onClick={() => { setActiveType(t); setActiveGroup(null); }} style={{
            padding: '8px 16px', fontSize: 'var(--crm-text-sm)', border: 'none', cursor: 'pointer', background: 'none',
            borderBottom: activeType === t ? '2px solid var(--crm-text-primary)' : '2px solid transparent',
            color: activeType === t ? 'var(--crm-text-primary)' : 'var(--crm-text-tertiary)',
            fontWeight: activeType === t ? 500 : 400, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--crm-space-4)' }}>
        {/* Left: groups list */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-3)', alignSelf: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)' }}>Groups</span>
            <button onClick={() => setShowAddGroup(true)} style={{ fontSize: 'var(--crm-text-xs)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>+ Add</button>
          </div>
          {typeGroups.map(g => {
            const count = assignments.filter(a => a.filter_group_id === g.id).length;
            return (
              <div key={g.id} onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)} style={{
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: activeGroup === g.id ? 'var(--crm-surface-hover)' : 'none',
              }}>
                <span style={{ fontSize: 'var(--crm-text-sm)' }}>{g.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--crm-text-tertiary)' }}>{count}</span>
                  <button onClick={e => { e.stopPropagation(); deleteGroup(g.id); }} style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }} title="Delete group">✕</button>
                </div>
              </div>
            );
          })}
          {typeGroups.length === 0 && <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', padding: 8 }}>No groups yet</div>}

          {/* Unassigned pseudo-group */}
          {unassigned.length > 0 && (
            <div onClick={() => setActiveGroup(activeGroup === '__unassigned' ? null : '__unassigned')} style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 8, borderTop: '1px solid var(--crm-border-light)', paddingTop: 12,
              background: activeGroup === '__unassigned' ? 'var(--crm-surface-hover)' : 'none',
            }}>
              <span style={{ fontSize: 'var(--crm-text-sm)', color: '#dc2626' }}>Unassigned</span>
              <span style={{ fontSize: 10, color: '#dc2626' }}>{unassigned.length}</span>
            </div>
          )}

          {/* Add group form */}
          {showAddGroup && (
            <div style={{ marginTop: 'var(--crm-space-3)', padding: 'var(--crm-space-3)', border: '1px solid var(--crm-border)', borderRadius: 6 }}>
              <input value={newGroup.label} onChange={e => setNewGroup({ label: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') })}
                placeholder="Label (e.g. Brown)" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 6 }} />
              <div style={{ fontSize: 10, color: 'var(--crm-text-tertiary)', marginBottom: 8 }}>Slug: {newGroup.slug || '—'}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={addGroup} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--crm-text-primary)', color: 'white', cursor: 'pointer' }}>Add</button>
                <button onClick={() => setShowAddGroup(false)} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: assignments */}
        <div className="crm-card" style={{ padding: 'var(--crm-space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}>
              {activeGroup === '__unassigned' ? `Unassigned products (no ${activeType})` : activeGroup ? `Products in "${typeGroups.find(g => g.id === activeGroup)?.label}"` : `All ${activeType} assignments`}
              <span style={{ marginLeft: 8, fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>({activeGroup === '__unassigned' ? unassigned.length : groupAssignments.length})</span>
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {autoCount > 0 && activeGroup !== '__unassigned' && (
                <button onClick={confirmAll} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: 'none', background: '#16a34a', color: 'white', cursor: 'pointer' }}>
                  ✓ Confirm All ({autoCount})
                </button>
              )}
              {activeGroup && activeGroup !== '__unassigned' && (
                <button onClick={() => setShowAssign(true)} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>+ Assign Product</button>
              )}
            </div>
          </div>

          {loading ? <div style={{ color: 'var(--crm-text-tertiary)', padding: 20 }}>Loading…</div> : activeGroup === '__unassigned' ? (
            /* Unassigned products table */
            <table className="crm-table" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ width: 180 }}>Assign to</th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {p.image && <img src={p.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} />}
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {p.title}
                            {p.status !== 'active' && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>{p.status}</span>}
                          </div>
                          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{p.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value) { assignToGroup(p.id, e.target.value); e.target.value = ''; } }}
                        style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--crm-border)' }}
                      >
                        <option value="">Select group…</option>
                        {typeGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="crm-table" style={{ width: '100%', fontSize: 'var(--crm-text-sm)' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  {!activeGroup && <th>Filter</th>}
                  <th style={{ width: 80 }}>Status</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupAssignments.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {a.image && <img src={a.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, background: '#f5f5f5' }} />}
                        <div>
                          <div style={{ fontWeight: 500 }}>{a.title}</div>
                          <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{a.handle}</div>
                        </div>
                      </div>
                    </td>
                    {!activeGroup && <td style={{ fontSize: 'var(--crm-text-xs)' }}>{a.filter_group_id}</td>}
                    <td>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: `${STATUS_COLOURS[a.status] ?? '#9ca3af'}15`, color: STATUS_COLOURS[a.status] ?? '#9ca3af' }}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {a.status === 'auto' && (
                          <button onClick={() => confirmAssignment(a.id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid #16a34a', background: 'none', color: '#16a34a', cursor: 'pointer' }}>Confirm</button>
                        )}
                        <button onClick={() => removeAssignment(a.product_id, a.filter_group_id)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, border: '1px solid #dc2626', background: 'none', color: '#dc2626', cursor: 'pointer' }}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && groupAssignments.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-sm)' }}>
              {activeGroup ? 'No products assigned to this group yet.' : 'Select a group to view assignments.'}
            </div>
          )}
        </div>
      </div>

      {/* Assign product modal */}
      {showAssign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowAssign(false); setAssignSearch(''); } }}>
          <div className="crm-card" style={{ width: 400, padding: 'var(--crm-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--crm-space-3)' }}>
              <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>Assign Product</h2>
              <button onClick={() => { setShowAssign(false); setAssignSearch(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--crm-text-tertiary)' }}>✕</button>
            </div>
            <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)} placeholder="Search products…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: '100%', marginBottom: 8 }} autoFocus />
            {filteredProducts.length > 1 && (
              <button onClick={async () => { for (const p of filteredProducts) await assignProduct(p.id); }} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--crm-text-primary)', color: 'white', cursor: 'pointer', marginBottom: 8 }}>
                Select All ({filteredProducts.length})
              </button>
            )}
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {filteredProducts.map(p => (
                <button key={p.id} onClick={() => assignProduct(p.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 'var(--crm-text-xs)', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--crm-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ fontWeight: 500 }}>{p.title}</div>
                  <div style={{ color: 'var(--crm-text-tertiary)' }}>{p.handle}</div>
                </button>
              ))}
              {assignSearch.length >= 2 && filteredProducts.length === 0 && (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 'var(--crm-text-xs)' }}>No unassigned products found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
