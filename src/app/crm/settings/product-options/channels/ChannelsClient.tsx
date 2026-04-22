'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Flow { id: string; code: string; label: string; channelType: string; status: string }

export default function ChannelsClient() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editChannel, setEditChannel] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/crm/configurator?entity=flow', { credentials: 'include' });
    if (res.ok) { const d = await res.json(); setFlows(d.data ?? []); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(id: string) {
    if (!editLabel.trim()) { setEditId(''); return; }
    await fetch('/api/crm/configurator', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'flow', id, label: editLabel.trim(), code: editCode.trim() || undefined, channelType: editChannel || undefined }),
    });
    setEditId(''); load();
  }

  async function create() {
    if (!editLabel.trim()) { setAdding(false); return; }
    const code = editCode.trim() || editLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await fetch('/api/crm/configurator', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'flow', label: editLabel.trim(), code, channelType: editChannel || code, status: 'draft' }),
    });
    setAdding(false); setEditLabel(''); setEditCode(''); setEditChannel(''); load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this channel and ALL its steps, groups, and choices?')) return;
    await fetch('/api/crm/configurator', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'flow', id }),
    });
    load();
  }

  async function toggleStatus(f: Flow) {
    const next = f.status === 'active' ? 'draft' : 'active';
    await fetch('/api/crm/configurator', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity: 'flow', id: f.id, status: next }),
    });
    load();
  }

  return (
    <div style={{ padding: 'var(--crm-space-6)', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3)', marginBottom: 'var(--crm-space-3)' }}>
        <Link href="/crm/settings/product-options" className="crm-btn crm-btn-ghost" style={{ padding: 0 }}>← Builder</Link>
      </div>
      <h1 style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, marginBottom: 'var(--crm-space-5)' }}>Channels</h1>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--crm-text-tertiary)', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flows.map(f => (
            <div key={f.id} className="crm-card" style={{ padding: '14px 16px' }}>
              {editId === f.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input className="crm-input" style={{ fontSize: 13 }} value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus placeholder="Label" onKeyDown={e => { if (e.key === 'Enter') save(f.id); if (e.key === 'Escape') setEditId(''); }} />
                  <input className="crm-input" style={{ fontSize: 12, fontFamily: 'monospace' }} value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="internal_code" />
                  <input className="crm-input" style={{ fontSize: 12 }} value={editChannel} onChange={e => setEditChannel(e.target.value)} placeholder="Channel type (e.g. optical, sun)" />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => save(f.id)}>Save</button>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => setEditId('')}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{f.label} <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--crm-text-tertiary)', fontWeight: 400 }}>{f.code}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--crm-text-tertiary)', marginTop: 2 }}>Channel: {f.channelType} · Status: {f.status}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => toggleStatus(f)}>{f.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setEditId(f.id); setEditLabel(f.label); setEditCode(f.code); setEditChannel(f.channelType); }}>✎</button>
                    <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--crm-error)' }} onClick={() => remove(f.id)}>✕</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {adding ? (
            <div className="crm-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input className="crm-input" style={{ fontSize: 13 }} value={editLabel} onChange={e => setEditLabel(e.target.value)} autoFocus placeholder="Channel name (e.g. Optical)" onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setAdding(false); }} />
                <input className="crm-input" style={{ fontSize: 12, fontFamily: 'monospace' }} value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="internal_code (auto-generated if empty)" />
                <input className="crm-input" style={{ fontSize: 12 }} value={editChannel} onChange={e => setEditChannel(e.target.value)} placeholder="Channel type (e.g. optical, sun, reglaze)" />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="crm-btn crm-btn-primary" style={{ fontSize: 11, padding: '4px 12px' }} onClick={create}>Create</button>
                  <button className="crm-btn crm-btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => { setAdding(false); setEditLabel(''); setEditCode(''); setEditChannel(''); }}>Cancel</button>
                </div>
              </div>
            </div>
          ) : (
            <button style={{ width: '100%', fontSize: 12, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--crm-text-primary)', fontWeight: 500 }} onClick={() => { setAdding(true); setEditLabel(''); setEditCode(''); setEditChannel(''); }}>+ Add channel</button>
          )}
        </div>
      )}
    </div>
  );
}
