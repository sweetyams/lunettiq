'use client';

import { useState, useEffect } from 'react';

interface ColourGroup { id: string; label: string; members: string[]; sortOrder: number }

export default function ColourGroupsPage() {
  const [groups, setGroups] = useState<ColourGroup[]>([]);
  const [editing, setEditing] = useState<ColourGroup | null>(null);
  const [newMember, setNewMember] = useState('');

  useEffect(() => { load(); }, []);

  function load() {
    fetch('/api/crm/settings/colour-groups', { credentials: 'include' })
      .then(r => r.json()).then(d => setGroups(d.data ?? [])).catch(() => {});
  }

  async function save(group: ColourGroup) {
    await fetch('/api/crm/settings/colour-groups', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group),
    });
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    await fetch('/api/crm/settings/colour-groups', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  }

  function addMember() {
    if (!editing || !newMember.trim()) return;
    const member = newMember.trim().toLowerCase().replace(/\s+/g, '-');
    if (!editing.members.includes(member)) {
      setEditing({ ...editing, members: [...editing.members, member] });
    }
    setNewMember('');
  }

  function removeMember(member: string) {
    if (!editing) return;
    setEditing({ ...editing, members: editing.members.filter(m => m !== member) });
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <a href="/crm/settings" style={{ fontSize: 'var(--crm-text-sm)', color: 'var(--crm-text-tertiary)', textDecoration: 'none' }}>← Settings</a>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-2)' }}>Colour Groups</h1>
      <p style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginBottom: 'var(--crm-space-5)' }}>
        Group related colours so storefront filters show simplified options (e.g., "Brown" includes tortoise, bronze, mocha)
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3)' }}>
        {groups.map(g => (
          <div key={g.id} className="crm-card" style={{ padding: 'var(--crm-space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 'var(--crm-text-sm)' }}>{g.label}</div>
              <div style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)', marginTop: 2 }}>
                {g.members.join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setEditing({ ...g })} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>Edit</button>
              <button onClick={() => remove(g.id)} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer', color: 'var(--crm-error)' }}>×</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setEditing({ id: '', label: '', members: [], sortOrder: groups.length + 1 })}
        className="crm-btn crm-btn-primary" style={{ marginTop: 'var(--crm-space-4)', fontSize: 'var(--crm-text-xs)' }}>
        + Add Group
      </button>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="crm-card" style={{ width: 400, padding: 'var(--crm-space-5)' }}>
            <h2 style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, marginBottom: 'var(--crm-space-4)' }}>
              {editing.id ? 'Edit Group' : 'New Group'}
            </h2>

            <div style={{ marginBottom: 'var(--crm-space-3)' }}>
              <label style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>ID (url-safe)</label>
              <input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="crm-input" style={{ width: '100%', fontSize: 'var(--crm-text-sm)', marginTop: 2 }} placeholder="brown" />
            </div>

            <div style={{ marginBottom: 'var(--crm-space-3)' }}>
              <label style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Display Label</label>
              <input value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })}
                className="crm-input" style={{ width: '100%', fontSize: 'var(--crm-text-sm)', marginTop: 2 }} placeholder="Brown" />
            </div>

            <div style={{ marginBottom: 'var(--crm-space-3)' }}>
              <label style={{ fontSize: 'var(--crm-text-xs)', color: 'var(--crm-text-tertiary)' }}>Members (raw colour handles that map to this group)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, marginBottom: 8 }}>
                {editing.members.map(m => (
                  <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 'var(--crm-text-xs)', background: 'var(--crm-surface-hover)', borderRadius: 4 }}>
                    {m}
                    <button onClick={() => removeMember(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--crm-text-tertiary)' }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMember(); } }}
                  className="crm-input" style={{ flex: 1, fontSize: 'var(--crm-text-xs)' }} placeholder="tortoise, bronze, mocha..." />
                <button onClick={addMember} style={{ fontSize: 'var(--crm-text-xs)', padding: '4px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>Add</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'var(--crm-space-4)' }}>
              <button onClick={() => setEditing(null)} style={{ fontSize: 'var(--crm-text-xs)', padding: '6px 14px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => save(editing)} disabled={!editing.id || !editing.label || !editing.members.length}
                className="crm-btn crm-btn-primary" style={{ fontSize: 'var(--crm-text-xs)' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
