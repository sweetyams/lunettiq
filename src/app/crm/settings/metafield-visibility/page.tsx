'use client';

import { useEffect, useState } from 'react';

interface Group { label: string; keys: string[] }

export default function MetafieldVisibilityPage() {
  const [visible, setVisible] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [newGroupLabel, setNewGroupLabel] = useState('');

  useEffect(() => {
    fetch('/api/crm/settings/metafield-visibility', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setVisible(d.data?.visible ?? []);
        setGroups(d.data?.groups ?? []);
        setAvailable(d.data?.available ?? []);
        setCoverage(d.data?.coverage ?? {});
        setTotalProducts(d.data?.totalProducts ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    await fetch('/api/crm/settings/metafield-visibility', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible, groups }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(key: string) {
    setVisible(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function addGroup() {
    if (!newGroupLabel.trim()) return;
    setGroups(prev => [...prev, { label: newGroupLabel.trim(), keys: [] }]);
    setNewGroupLabel('');
  }

  function removeGroup(idx: number) {
    setGroups(prev => prev.filter((_, i) => i !== idx));
  }

  function renameGroup(idx: number, label: string) {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, label } : g));
  }

  function addFieldToGroup(groupIdx: number, key: string) {
    setGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return { ...g, keys: g.keys.filter(k => k !== key) };
      return g.keys.includes(key) ? g : { ...g, keys: [...g.keys, key] };
    }));
  }

  function removeFieldFromGroup(groupIdx: number, key: string) {
    setGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, keys: g.keys.filter(k => k !== key) } : g));
  }

  function formatKey(key: string): string {
    return key.replace(/^custom\./, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const groupedKeySet = new Set(groups.flatMap(g => g.keys));
  const ungroupedKeys = available.filter(k => !groupedKeySet.has(k));

  return (
    <div style={{ padding: 'var(--crm-space-6)' }}>
      <div style={{ marginBottom: 'var(--crm-space-4)' }}>
        <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
        <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>Product Metafields</h1>
        <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
          Manage groups and choose which fields show on product pages.
        </p>
      </div>

      {loading ? <div style={{ color: 'var(--crm-text-tertiary)' }}>Loading…</div> : (
        <>
          {/* Groups */}
          {groups.map((group, gi) => (
            <div key={gi} className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                {editingGroup === gi ? (
                  <input value={group.label} onChange={e => renameGroup(gi, e.target.value)} onBlur={() => setEditingGroup(null)} onKeyDown={e => e.key === 'Enter' && setEditingGroup(null)} autoFocus
                    className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, width: 160, padding: '2px 6px' }} />
                ) : (
                  <button onClick={() => setEditingGroup(gi)} style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', letterSpacing: '0.04em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {group.label} ✎
                  </button>
                )}
                <button onClick={() => removeGroup(gi)} style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove group</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.keys.filter(k => available.includes(k)).map(key => {
                  const count = coverage[key] ?? 0;
                  const pct = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
                  const isOn = visible.includes(key);
                  return (
                    <div key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, borderRadius: 20, overflow: 'hidden', border: isOn ? '1.5px solid var(--crm-text-primary)' : '1px solid var(--crm-border)' }}>
                      <button onClick={() => toggle(key)} style={{
                        padding: '5px 10px', cursor: 'pointer', border: 'none',
                        background: isOn ? 'var(--crm-text-primary)' : 'var(--crm-surface)',
                        color: isOn ? 'white' : 'var(--crm-text-primary)',
                        fontSize: 'var(--crm-text-xs)', fontWeight: 500, transition: 'all 150ms var(--ease-out)',
                      }}>
                        {formatKey(key)} <span style={{ fontSize: 9, opacity: 0.7 }}>{pct}%</span>
                      </button>
                      <button onClick={() => removeFieldFromGroup(gi, key)} style={{ padding: '5px 6px', border: 'none', borderLeft: '1px solid var(--crm-border-light)', background: 'var(--crm-surface)', color: 'var(--crm-text-tertiary)', cursor: 'pointer', fontSize: 10 }}>✕</button>
                    </div>
                  );
                })}
                {/* Add field dropdown */}
                <select onChange={e => { if (e.target.value) { addFieldToGroup(gi, e.target.value); e.target.value = ''; } }} value=""
                  style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 8px', borderRadius: 20, border: '1px dashed var(--crm-border)', background: 'none', color: 'var(--crm-text-tertiary)', cursor: 'pointer' }}>
                  <option value="">+ Add field</option>
                  {ungroupedKeys.sort().map(k => <option key={k} value={k}>{formatKey(k)}</option>)}
                </select>
              </div>
            </div>
          ))}

          {/* Add group */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--crm-space-4)' }}>
            <input value={newGroupLabel} onChange={e => setNewGroupLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()}
              placeholder="New group name…" className="crm-input" style={{ fontSize: 'var(--crm-text-xs)', width: 180 }} />
            <button onClick={addGroup} className="crm-btn crm-btn-secondary" style={{ fontSize: 'var(--crm-text-xs)' }}>+ Add Group</button>
          </div>

          {/* Ungrouped fields */}
          {ungroupedKeys.length > 0 && (
            <div className="crm-card" style={{ padding: 'var(--crm-space-4)', marginBottom: 'var(--crm-space-3)' }}>
              <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--crm-text-tertiary)', marginBottom: 8, letterSpacing: '0.04em' }}>Ungrouped</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ungroupedKeys.sort().map(key => {
                  const count = coverage[key] ?? 0;
                  const pct = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
                  const isOn = visible.includes(key);
                  return (
                    <button key={key} onClick={() => toggle(key)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                      border: isOn ? '1.5px solid var(--crm-text-primary)' : '1px solid var(--crm-border)',
                      background: isOn ? 'var(--crm-text-primary)' : 'var(--crm-surface)',
                      color: isOn ? 'white' : 'var(--crm-text-primary)',
                      fontSize: 'var(--crm-text-xs)', fontWeight: 500, transition: 'all 150ms var(--ease-out)',
                    }}>
                      <span>{formatKey(key)}</span>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>{pct}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={save} className="crm-btn crm-btn-primary" style={{ padding: '8px 20px' }}>Save</button>
            {saved && <span style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-success, #16a34a)' }}>✓ Saved</span>}
            <span style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>{visible.length} fields visible · {groups.length} groups</span>
          </div>
        </>
      )}
    </div>
  );
}
